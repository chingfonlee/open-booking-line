import type {
  BroadSlot,
  DateAvailability,
  AvailabilityConfig,
  AvailabilityResponse,
  SlotUnavailableReason
} from '../../shared/types.ts';

export interface D1Like {
  prepare(sql: string): {
    bind(...params: any[]): {
      all<T = any>(): Promise<{ results: T[] }> | { results: T[] };
      first<T = any>(): Promise<T | null> | T | null;
    };
    all<T = any>(...params: any[]): Promise<{ results: T[] }> | { results: T[] };
    first<T = any>(...params: any[]): Promise<T | null> | T | null;
  };
}

/**
 * 取得固定 Asia/Taipei (UTC+8) 之當前日期字串 (YYYY-MM-DD)
 */
export function getTaipeiToday(nowDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(nowDate);
}

/**
 * 純日曆天位移加減 (依據 UTC 年月日計算，不受夏令時間干擾)
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * 取得指定日期的星期幾 (0 = 週日, 1 = 週一, ..., 6 = 週六)
 */
export function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCDay();
}

/**
 * 檢查是否為合法 YYYY-MM-DD 日期格式
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export interface AvailabilityEngineOptions {
  db: D1Like;
  fromDate?: string;
  toDate?: string;
  singleDate?: string;
  nowDate?: Date; // 支援測試注入固定 Mock Clock
  isAdmin?: boolean; // 若為 true，代表管理員排程查詢（無 lead_time 限制，窗口至 T+60）
}

/**
 * 讀取資料庫設定 (mode, lead_time_days, booking_horizon_days)
 */
export async function loadAvailabilityConfig(db: D1Like): Promise<AvailabilityConfig> {
  let mode: 'legacy' | 'managed' = 'legacy';
  let lead_time_days = 1;
  let booking_horizon_days = 30;

  try {
    const configRes = await db.prepare('SELECT key, value FROM availability_config').all<{ key: string; value: string }>();
    const rows = configRes?.results || [];
    for (const row of rows) {
      if (row.key === 'mode') {
        mode = row.value === 'managed' ? 'managed' : 'legacy';
      } else if (row.key === 'lead_time_days') {
        const val = parseInt(row.value, 10);
        if (!isNaN(val) && val >= 0) lead_time_days = val;
      } else if (row.key === 'booking_horizon_days') {
        const val = parseInt(row.value, 10);
        if (!isNaN(val) && val > 0) booking_horizon_days = val;
      }
    }
  } catch (err) {
    // 若表不存在（尚未遷移），安全降級回 legacy 預設
    mode = 'legacy';
  }

  return { mode, lead_time_days, booking_horizon_days };
}

/**
 * 核心 Availability 計算引擎 (Single Source of Truth)
 * 嚴格遵循公式：
 * Weekly Rules - Exceptions - Active Reservations - Invalid/Past Dates = Selectable Broad Slots
 * Pending Requests 絕不扣除！
 */
export async function computeAvailability(
  options: AvailabilityEngineOptions
): Promise<AvailabilityResponse> {
  const { db, singleDate, nowDate = new Date(), isAdmin = false } = options;
  const today = getTaipeiToday(nowDate);
  const config = await loadAvailabilityConfig(db);

  // 計算有效查詢範圍
  let effectiveFrom: string;
  let effectiveTo: string;

  if (singleDate) {
    if (!isValidDateString(singleDate)) {
      throw new Error(`Invalid singleDate: ${singleDate}. Expected YYYY-MM-DD.`);
    }
    effectiveFrom = singleDate;
    effectiveTo = singleDate;
  } else {
    const defaultEarliest = isAdmin ? today : addDays(today, config.lead_time_days);
    const defaultLatest = isAdmin
      ? addDays(today, 60)
      : addDays(today, config.booking_horizon_days);

    effectiveFrom = options.fromDate && isValidDateString(options.fromDate) ? options.fromDate : defaultEarliest;
    effectiveTo = options.toDate && isValidDateString(options.toDate) ? options.toDate : defaultLatest;

    if (effectiveFrom > effectiveTo) {
      throw new Error(`fromDate (${effectiveFrom}) cannot be after toDate (${effectiveTo})`);
    }
  }

  // 1. 載入每週循環規則 (僅 managed 模式需套用)
  const rulesMap = new Map<string, number>(); // key: `${dow}_${slot}` -> is_enabled
  if (config.mode === 'managed') {
    try {
      const rulesRes = await db.prepare('SELECT day_of_week, slot_code, is_enabled FROM availability_rules').all<{
        day_of_week: number;
        slot_code: string;
        is_enabled: number;
      }>();
      for (const r of rulesRes?.results || []) {
        rulesMap.set(`${r.day_of_week}_${r.slot_code}`, r.is_enabled);
      }
    } catch {
      // 容錯防護
    }
  }

  // 2. 載入指定範圍內的例外封鎖 (availability_exceptions)
  const exceptionsMap = new Map<string, Set<string>>(); // date -> Set<slot_code> ('all', 'morning', 'afternoon')
  try {
    const exRes = await db.prepare(
      'SELECT exception_date, slot_code FROM availability_exceptions WHERE exception_date BETWEEN ? AND ?'
    ).bind(effectiveFrom, effectiveTo).all<{ exception_date: string; slot_code: string }>();

    for (const ex of exRes?.results || []) {
      if (!exceptionsMap.has(ex.exception_date)) {
        exceptionsMap.set(ex.exception_date, new Set());
      }
      exceptionsMap.get(ex.exception_date)!.add(ex.slot_code);
    }
  } catch {
    // 容錯防護
  }

  // 3. 載入指定範圍內的正式活躍預約 (slot_reservations WHERE status = 'active')
  const reservationsMap = new Map<string, Set<string>>(); // date -> Set<slot_code> ('morning', 'afternoon')
  try {
    const rsvRes = await db.prepare(
      "SELECT booking_date, slot_code FROM slot_reservations WHERE status = 'active' AND booking_date BETWEEN ? AND ?"
    ).bind(effectiveFrom, effectiveTo).all<{ booking_date: string; slot_code: string }>();

    for (const r of rsvRes?.results || []) {
      if (!reservationsMap.has(r.booking_date)) {
        reservationsMap.set(r.booking_date, new Set());
      }
      reservationsMap.get(r.booking_date)!.add(r.slot_code);
    }
  } catch {
    // 容錯防護
  }

  // 4. 計算每日每個 Broad Slot 之可用性
  const dates: Record<string, DateAvailability> = {};
  let currentDate = effectiveFrom;

  // 定義農友端與管理員端允許的邊界
  const minFarmerDate = addDays(today, config.lead_time_days);
  const maxFarmerDate = addDays(today, config.booking_horizon_days);
  const maxAdminDate = addDays(today, 60);

  while (currentDate <= effectiveTo) {
    let morningAvailable = true;
    let afternoonAvailable = true;
    let morningReason: SlotUnavailableReason | null = null;
    let afternoonReason: SlotUnavailableReason | null = null;

    // 4-1. 檢查日期範圍限制 (Past / Lead Time / Horizon)
    if (isAdmin) {
      if (currentDate < today) {
        morningAvailable = false;
        afternoonAvailable = false;
        morningReason = 'past';
        afternoonReason = 'past';
      } else if (currentDate > maxAdminDate) {
        morningAvailable = false;
        afternoonAvailable = false;
        morningReason = 'outside_horizon';
        afternoonReason = 'outside_horizon';
      }
    } else {
      if (currentDate < today) {
        morningAvailable = false;
        afternoonAvailable = false;
        morningReason = 'past';
        afternoonReason = 'past';
      } else if (currentDate < minFarmerDate) {
        morningAvailable = false;
        afternoonAvailable = false;
        morningReason = 'lead_time';
        afternoonReason = 'lead_time';
      } else if (currentDate > maxFarmerDate) {
        morningAvailable = false;
        afternoonAvailable = false;
        morningReason = 'outside_horizon';
        afternoonReason = 'outside_horizon';
      }
    }

    // 若未被日期邊界剔除，繼續計算每週規則、例外與預約鎖定
    if (morningAvailable || afternoonAvailable) {
      const dow = getDayOfWeek(currentDate);

      // (A) 每週循環規則 (Managed 模式)
      if (config.mode === 'managed') {
        const morningRule = rulesMap.get(`${dow}_morning`);
        if (morningRule === 0) {
          morningAvailable = false;
          morningReason = 'weekly_closed';
        }
        const afternoonRule = rulesMap.get(`${dow}_afternoon`);
        if (afternoonRule === 0) {
          afternoonAvailable = false;
          afternoonReason = 'weekly_closed';
        }
      }

      // (B) 特定日期例外封鎖 (Exceptions)
      const dayExceptions = exceptionsMap.get(currentDate);
      if (dayExceptions) {
        if (dayExceptions.has('all') || dayExceptions.has('morning')) {
          morningAvailable = false;
          morningReason = 'blocked';
        }
        if (dayExceptions.has('all') || dayExceptions.has('afternoon')) {
          afternoonAvailable = false;
          afternoonReason = 'blocked';
        }
      }

      // (C) 扣除正式保留時段 (Active Reservations)
      const dayReservations = reservationsMap.get(currentDate);
      if (dayReservations) {
        if (dayReservations.has('morning')) {
          morningAvailable = false;
          morningReason = 'reserved';
        }
        if (dayReservations.has('afternoon')) {
          afternoonAvailable = false;
          afternoonReason = 'reserved';
        }
      }
    }

    // 計算都可以 (any) 與當日是否具備任一可選時段
    const anyAvailable = morningAvailable || afternoonAvailable;
    const selectable = morningAvailable || afternoonAvailable;

    dates[currentDate] = {
      date: currentDate,
      selectable,
      slots: {
        morning: morningAvailable,
        afternoon: afternoonAvailable,
        any: anyAvailable
      },
      reasons: {
        morning: morningReason,
        afternoon: afternoonReason
      }
    };

    // 前進至下一天
    currentDate = addDays(currentDate, 1);
  }

  return {
    mode: config.mode,
    timezone: 'Asia/Taipei',
    today,
    lead_time_days: config.lead_time_days,
    booking_horizon_days: config.booking_horizon_days,
    window: {
      earliest: isAdmin ? today : minFarmerDate,
      latest: isAdmin ? maxAdminDate : maxFarmerDate
    },
    dates
  };
}

/**
 * 快速驗證特定日期與時段是否允許預約 (供送單檢核與排程碰撞檢驗使用)
 */
export async function isSlotAvailable(
  db: D1Like,
  dateStr: string,
  slotCode: BroadSlot | 'any',
  nowDate: Date = new Date(),
  isAdmin: boolean = false
): Promise<{ available: boolean; reason?: SlotUnavailableReason | null }> {
  const result = await computeAvailability({
    db,
    singleDate: dateStr,
    nowDate,
    isAdmin
  });

  const dayData = result.dates[dateStr];
  if (!dayData) {
    return { available: false, reason: 'outside_horizon' };
  }

  if (slotCode === 'any') {
    return { available: dayData.slots.any };
  }

  return {
    available: dayData.slots[slotCode],
    reason: dayData.reasons[slotCode]
  };
}
