import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import {
  generateFlexNotification,
  generateCustomerConfirmationFlex,
  generateScheduledConfirmationFlex,
  generateProgressQueryFlex,
  generateWelcomeGuideFlex,
  generateAdminPortalFlex,
  pushLineMessage,
  replyLineMessage,
  verifyLineIdToken,
  verifyLineSignature
} from './line';
import { verifyTurnstileToken } from './turnstile';
import { computeAvailability, isSlotAvailable } from './availability.ts';
import type { CreateServiceRequestDto, UpdateServiceRequestDto, RequestStatus } from '../../shared/types.ts';

type Bindings = {
  DB: D1Database;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  LINE_CHANNEL_SECRET?: string;
  ADMIN_NOTIFY_USER_ID?: string;
  ADMIN_LINE_IDS?: string;
  STATION_NAME?: string;
  ALLOWED_ORIGINS?: string;
  FRONTEND_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  LINE_LOGIN_CHANNEL_ID?: string;
  LIFF_ID?: string;
};

// 輕量應用層防連按與滑動窗口頻率限制 (In-Memory Sliding Window)
// 定位說明：主要防禦「同用戶連續手抖重複點擊」與「單一節點短時間連發」，具備零外部依賴、零維運成本優勢。
// 惡意爬蟲自動化刷單已由前置之 Cloudflare Turnstile 真人驗證全面阻絕。
const submissionRateMap = new Map<string, number[]>(); // key: IP+Phone, value: timestamps
// 已授權的服務人員 LINE Token 快取
const verifiedAdminTokens = new Map<string, { sub: string; name?: string; picture?: string; exp: number }>();

function isSubmissionRateLimited(key: string): boolean {
  if (!key || (key.startsWith('unknown_') && key.endsWith('_'))) return false;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 分鐘
  const maxSubmissions = 5; // 10 分鐘內最多 5 次

  // 記憶體自我防護：若快取筆數累積過多，自動清理已過期的鍵值，避免無效佔用 Worker 記憶體
  if (submissionRateMap.size > 500) {
    for (const [k, v] of submissionRateMap.entries()) {
      if (!v.some(t => now - t < windowMs)) {
        submissionRateMap.delete(k);
      }
    }
  }

  const timestamps = (submissionRateMap.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxSubmissions) {
    return true;
  }
  timestamps.push(now);
  submissionRateMap.set(key, timestamps);
  return false;
}

async function getAdminFromToken(c: any): Promise<{ sub: string; name?: string; picture?: string } | null> {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : c.req.header('x-line-token');
  if (!token) return null;

  const now = Date.now();
  const cached = verifiedAdminTokens.get(token);
  if (cached && cached.exp > now) {
    return cached;
  }

  const profile = await verifyLineIdToken(token, c.env.LINE_LOGIN_CHANNEL_ID);
  if (!profile) return null;

  const allowedIds = [
    ...(c.env.ADMIN_LINE_IDS ? c.env.ADMIN_LINE_IDS.split(',').map((s: string) => s.trim()) : []),
    c.env.ADMIN_NOTIFY_USER_ID
  ].filter(Boolean);

  if (!allowedIds.includes(profile.sub)) {
    return null;
  }

  // 遵守 LINE ID Token 壽命：若 LINE 本身 exp 較早過期則以 LINE 為準，本地快取最多不超過 10 分鐘
  const lineExpMs = profile.exp ? profile.exp * 1000 : (now + 10 * 60 * 1000);
  const effectiveExp = Math.min(lineExpMs, now + 10 * 60 * 1000);

  if (effectiveExp <= now) {
    return null;
  }

  // 自動清理過期快取
  if (verifiedAdminTokens.size > 200) {
    for (const [k, v] of verifiedAdminTokens.entries()) {
      if (v.exp <= now) verifiedAdminTokens.delete(k);
    }
  }

  const adminData = {
    sub: profile.sub,
    name: profile.name,
    picture: profile.picture,
    exp: effectiveExp
  };
  verifiedAdminTokens.set(token, adminData);
  return adminData;
}

const app = new Hono<{ Bindings: Bindings }>();

// 限縮 CORS 來源，支援環境變數自訂、LIFF 官方應用與本機開發環境
app.use('*', cors({
  origin: (origin, c) => {
    if (!origin) return null;

    // 1. 本機開發環境與 LINE LIFF 官方標準網域永遠允許
    if (
      origin === 'https://liff.line.me' ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return origin;
    }

    // 2. 自訂允許網域清單 (支援逗點分隔多組網域，例如 "https://farm.pages.dev,https://booking.example.com")
    // 若管理者明確配置了 ALLOWED_ORIGINS 或 FRONTEND_URL，嚴格收斂至該清單，不再向下相容任意網域
    const envOrigins = (c.env as Bindings).ALLOWED_ORIGINS || (c.env as Bindings).FRONTEND_URL || '';
    if (envOrigins) {
      const allowedList = envOrigins.split(',').map((s: string) => s.trim().replace(/\/$/, ''));
      const isAllowed = allowedList.some((allowed: string) => {
        if (allowed === origin) return true;
        // 支援包含協定的萬用字元比對（如 https://*.pages.dev）
        if (allowed.includes('*')) {
          const pattern = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
          if (pattern.test(origin)) return true;
        }
        return false;
      });
      return isAllowed ? origin : null;
    }

    // 3. 預設模式（未配置 ALLOWED_ORIGINS 時）：為降低新手安裝難度，自動相容所有 Cloudflare Pages 網域 (*.pages.dev)
    if (origin.startsWith('https://') && origin.endsWith('.pages.dev')) {
      return origin;
    }

    return null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-line-token', 'cf-connecting-ip']
}));

// 加入標準安全標頭 (防 MIME 混淆、防點擊劫持、強制 HTTPS、CSP)
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.res.headers.set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'self' https://liff.line.me;");
});

// 全域未捕獲異常處理 (確保永不丟失 CORS 標頭，且不外洩內部資料庫或伺服器錯誤細節)
app.onError((err, c) => {
  console.error('Unhandled server error:', err);
  return c.json({
    success: false,
    message: '伺服器發生暫時性異常，請稍後再試或直接電話聯繫服務站。'
  }, 500);
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', station: c.env.STATION_NAME || '高雄服務站', time: new Date().toISOString() });
});

// Ep03: 查詢時段可用性 (Availability Read API)
app.get('/api/availability', async (c) => {
  try {
    const singleDate = c.req.query('date');
    let fromDate = c.req.query('from');
    let toDate = c.req.query('to');
    const month = c.req.query('month');

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      fromDate = `${month}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      toDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    }

    // 若有提供管理者身分 token 且有效，啟用 admin 排程視窗權限
    let isAdmin = false;
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : c.req.header('x-line-token');
    if (token) {
      const admin = await getAdminFromToken(c);
      if (admin) isAdmin = true;
    }

    const data = await computeAvailability({
      db: c.env.DB,
      singleDate,
      fromDate,
      toDate,
      isAdmin
    });

    return c.json({ success: true, data });
  } catch (error: any) {
    console.error('Availability query error:', error);
    return c.json({ success: false, message: error.message || '查詢可用性時段失敗' }, 400);
  }
});

// 1. 農友送出服務申請 (含 Request Body 限制、IP + 電話複合頻率限制、Turnstile 無感真人驗證與 LINE ID Token 簽名驗證)
app.post(
  '/api/requests',
  bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) => c.json({ success: false, message: '送出的資料過大，超過 32KB 限制' }, 413)
  }),
  async (c) => {
    try {
      const rawBody = await c.req.text().catch(() => '');
      let body: CreateServiceRequestDto | null = null;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return c.json({ success: false, message: '請求資料格式不正確，請重新整理後再試' }, 400);
      }

      if (!body) {
        return c.json({ success: false, message: '請求資料不能為空' }, 400);
      }

      const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
      const cleanPhone = (body.phone || '').replace(/[-\s]/g, '');
      const rateLimitKey = `${clientIp}_${cleanPhone}`;

      if (isSubmissionRateLimited(rateLimitKey)) {
        return c.json({
          success: false,
          message: '送單頻率過高，為保護系統資源請於 10 分鐘後再試，或直接電話聯繫服務站。'
        }, 429);
      }

      // 1-1. Cloudflare Turnstile 無感真人驗證 (強制必填，防範無 Token 繞過)
      const turnstileSecret = c.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
      if (!body.turnstile_token) {
        return c.json({ success: false, message: '缺少真人安全驗證標記，請重新整理頁面後再試。' }, 400);
      }
      const turnstileRes = await verifyTurnstileToken(body.turnstile_token, turnstileSecret, clientIp);
      if (!turnstileRes.success) {
        console.warn('Turnstile rejection:', turnstileRes.errorCodes);
        return c.json({ success: false, message: '真人安全驗證未通過，請重新整理頁面後再試。' }, 403);
      }
      
      if (!body.contact_name || !body.phone || !body.service_type || !body.preferred_date) {
        return c.json({ success: false, message: '請完整填寫姓名、電話、服務項目與希望施工日期' }, 400);
      }

      // 1-2. 資料長度上限嚴格校驗 (直接驗證真實寫入 DB 之欄位，防止惡意文字灌爆 D1 資料庫)
      if ((body.contact_name || '').length > 50) {
        return c.json({ success: false, message: '姓名長度不能超過 50 個字' }, 400);
      }
      if ((body.phone || '').length > 25) {
        return c.json({ success: false, message: '電話長度不能超過 25 個字' }, 400);
      }
      if ((body.service_type || '').length > 50) {
        return c.json({ success: false, message: '服務項目長度不能超過 50 個字' }, 400);
      }
      if ((body.crop_type || '').length > 50) {
        return c.json({ success: false, message: '作物種類長度不能超過 50 個字' }, 400);
      }
      if ((body.area_value || '').length > 30) {
        return c.json({ success: false, message: '面積欄位長度不能超過 30 個字' }, 400);
      }
      if ((body.location_area || '').length > 30) {
        return c.json({ success: false, message: '服務地區長度不能超過 30 個字' }, 400);
      }
      if ((body.location_address || '').length > 200) {
        return c.json({ success: false, message: '服務詳細地址長度不能超過 200 個字' }, 400);
      }
      if (body.notes && body.notes.length > 1000) {
        return c.json({ success: false, message: '補充備註長度不能超過 1000 個字' }, 400);
      }

      const isMobile = /^09\d{8}$/.test(cleanPhone);
      const isLandline = /^0[2-8]\d{7}$/.test(cleanPhone);

      if (!isMobile && !isLandline) {
        return c.json({ success: false, message: '電話格式錯誤：手機需為 09 開頭 10 碼，市話需為 02-08 開頭 9 碼數字' }, 400);
      }

      if ((body.crop_type || '').includes('其他') && !body.notes?.trim()) {
        return c.json({ success: false, message: '選擇其他作物種類時，請在補充備註填寫作物種類' }, 400);
      }

      // 1-2. Ep03 送單時段與可用性防護 (Submit Re-validation)
      const slotCode = body.preferred_time_slot || 'morning';
      if (!['morning', 'afternoon', 'any'].includes(slotCode)) {
        return c.json({ success: false, message: '偏好時段格式錯誤，僅允許上午、下午或都可以' }, 400);
      }

      if (body.preferred_date) {
        const slotCheck = await isSlotAvailable(
          c.env.DB,
          body.preferred_date,
          slotCode as any,
          new Date(),
          false
        );

        if (!slotCheck.available) {
          let errorMsg = `您選擇的日期或時段 (${body.preferred_date}) 目前不可預約，請選擇其他時段或日期！`;
          if (slotCheck.reason === 'reserved') {
            errorMsg = `您選擇的時段 (${body.preferred_date}) 已由其他農友正式確認預約，請選擇其他時段或日期！`;
          } else if (slotCheck.reason === 'lead_time' || slotCheck.reason === 'past') {
            errorMsg = `預約施工必須至少提前 1 天申請，無法預約過去或當天時段！`;
          } else if (slotCheck.reason === 'outside_horizon') {
            errorMsg = `預約日期超出服務站開放範圍（最多 30 天內），請選擇其他日期！`;
          } else if (slotCheck.reason === 'weekly_closed') {
            errorMsg = `該日服務站未開放營業預約，請選擇其他日期！`;
          } else if (slotCheck.reason === 'blocked') {
            errorMsg = `您選擇的日期 (${body.preferred_date}) 目前服務站已額滿或暫停排程，請選擇其他日期！`;
          }
          return c.json({ success: false, message: errorMsg }, 400);
        }
      }

      // 1-3. LINE ID Token 簽名驗證（防偽身分綁定）
      // 安全防護：絕不可盲目信任前端傳送之 body.line_user_id，徹底杜絕偽造他人 UID 進行身分冒用、騷擾推播或查詢竄改
      // 只有經過 LINE 官方 OAuth 密碼學校驗成功的 ID Token，才能綁定該使用者的真實 UID (profile.sub)
      let verifiedLineUserId: string | null = null;
      if (body.id_token) {
        const lineProfile = await verifyLineIdToken(body.id_token, c.env.LINE_LOGIN_CHANNEL_ID);
        if (lineProfile && lineProfile.sub) {
          verifiedLineUserId = lineProfile.sub;
        }
      }

      // 訂單編號高熵防碰撞：使用 10 碼 HEX（16^10 = 1.09 兆種隨機組合）
      const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const id = 'REQ-' + datePrefix + '-' + randomSuffix;
      const now = new Date().toISOString();

      // 安全防護：不信任未校驗之 body.area_size，統一從經檢核之 area_value 與 area_unit 組合計算
      const computedAreaSize = body.area_value ? `${body.area_value} ${body.area_unit || '分'}` : '未填寫';

      const insertSql = 'INSERT INTO service_requests (' +
        'id, created_at, updated_at, contact_name, phone, service_type, crop_type, ' +
        'area_size, area_value, area_unit, branch_volume, location_area, location_address, preferred_date, preferred_time_slot, ' +
        'date_flexibility, notes, status, line_user_id' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      await c.env.DB.prepare(insertSql).bind(
        id, now, now,
        (body.contact_name || '').trim(),
        cleanPhone,
        body.service_type,
        body.crop_type || '其他',
        computedAreaSize,
        body.area_value ? String(body.area_value) : null,
        body.area_unit || null,
        body.branch_volume || '中量',
        body.location_area || '',
        body.location_address || '',
        body.preferred_date,
        body.preferred_time_slot || 'morning',
        body.date_flexibility || '前後 3 天皆可',
        body.notes || '',
        'to_contact',
        verifiedLineUserId
      ).run();

      // 1. 推播給服務人員（通知有新案件需求，附農民電話一鍵撥打按鈕）
      if (c.env.LINE_CHANNEL_ACCESS_TOKEN && c.env.ADMIN_NOTIFY_USER_ID) {
        const adminFlexMsg = generateFlexNotification({
          ...body,
          area_size: computedAreaSize,
          id
        }, c.env.LIFF_ID, c.env.STATION_NAME);
        c.executionCtx.waitUntil(
          pushLineMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, c.env.ADMIN_NOTIFY_USER_ID, adminFlexMsg, c.env.DB)
        );
      }

      // 2. 推播給申請農民（發送服務申請確認收據卡片）
      if (c.env.LINE_CHANNEL_ACCESS_TOKEN && verifiedLineUserId) {
        const customerFlexMsg = generateCustomerConfirmationFlex({
          ...body,
          area_size: computedAreaSize,
          id
        }, c.env.LIFF_ID, c.env.STATION_NAME);
        c.executionCtx.waitUntil(
          pushLineMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, verifiedLineUserId, customerFlexMsg, c.env.DB)
        );
      }

      return c.json({
        success: true,
        message: '服務申請已成功送出，服務站人員將儘速電話與您聯繫！',
        data: { id }
      }, 201);
    } catch (error: any) {
      console.error('Submit request error:', error);
      return c.json({ success: false, message: '伺服器暫時發生錯誤，請稍後再試或電話聯繫服務站' }, 500);
    }
  }
);

// 服務人員 LINE 白名單身分驗證端點
app.post('/api/admin/auth/line', async (c) => {
  try {
    const body = await c.req.json<{ id_token: string }>().catch(() => ({ id_token: '' }));
    if (!body.id_token) {
      return c.json({ success: false, message: '缺少 LINE ID 憑證' }, 400);
    }

    const profile = await verifyLineIdToken(body.id_token, c.env.LINE_LOGIN_CHANNEL_ID);
    if (!profile) {
      return c.json({ success: false, message: 'LINE 身分憑證無效或已過期，請重新登入' }, 401);
    }

    const allowedIds = [
      ...(c.env.ADMIN_LINE_IDS ? c.env.ADMIN_LINE_IDS.split(',').map((s: string) => s.trim()) : []),
      c.env.ADMIN_NOTIFY_USER_ID
    ].filter(Boolean);

    if (!allowedIds.includes(profile.sub)) {
      return c.json({
        success: false,
        message: '存取受限：您的 LINE 帳號不在授權服務人員白名單內。',
        userId: profile.sub,
        displayName: profile.name
      }, 403);
    }

    // 加入服務人員 Session 快取 (遵守 LINE 官方 Token 壽命，最長 10 分鐘)
    const authNow = Date.now();
    const lineExpMs = profile.exp ? profile.exp * 1000 : (authNow + 10 * 60 * 1000);
    const effectiveExp = Math.min(lineExpMs, authNow + 10 * 60 * 1000);

    verifiedAdminTokens.set(body.id_token, {
      sub: profile.sub,
      name: profile.name,
      picture: profile.picture,
      exp: effectiveExp
    });

    return c.json({
      success: true,
      message: '服務人員身分驗證成功',
      user: {
        userId: profile.sub,
        displayName: profile.name,
        pictureUrl: profile.picture
      }
    });
  } catch (err: any) {
    console.error('Admin auth error:', err);
    return c.json({ success: false, message: '身分驗證程序異常，請稍後再試' }, 500);
  }
});

// 站所服務人員權限檢核 (純 LINE 服務人員白名單 Token 鑑權，零靜態密碼)
app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/auth/line') {
    return next();
  }

  // 嚴格檢驗 LINE 服務人員白名單 Token
  const admin = await getAdminFromToken(c);
  if (admin) {
    return next();
  }

  return c.json({ success: false, message: '未經授權：請透過授權服務人員 LINE 帳號登入系統' }, 401);
});

// 2. 站所人員查詢申請單列表 (Ep03: 左連接 active reservation 取得正式排程)
app.get('/api/admin/requests', async (c) => {
  try {
    const status = c.req.query('status') as RequestStatus | undefined;
    let query = 'SELECT r.*, s.booking_date as scheduled_date, s.slot_code as scheduled_slot_code, s.scheduled_start_time, s.notes as customer_notice ' +
      'FROM service_requests r ' +
      "LEFT JOIN slot_reservations s ON r.id = s.request_id AND s.status = 'active'";
    const params: any[] = [];

    if (status && ['to_contact', 'confirmed', 'processing', 'closed', 'cancelled'].includes(status)) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }

    // 排序策略：
    // 已確認 (confirmed) 或 施工中 (processing) 案件以正式排程日期 (scheduled_date) 由近到遠排序 (ASC)，同日期依開工時間排序
    // 待聯絡 (to_contact)、已結案 (closed) 或其他狀態則依建立時間由新到舊排序 (created_at DESC)
    if (status === 'confirmed' || status === 'processing') {
      query += ' ORDER BY CASE WHEN s.booking_date IS NULL THEN 1 ELSE 0 END, s.booking_date ASC, s.scheduled_start_time ASC, r.created_at DESC';
    } else {
      query += ' ORDER BY r.created_at DESC';
    }

    const result = await c.env.DB.prepare(query).bind(...params).all();

    const countSql = 'SELECT ' +
      "SUM(CASE WHEN status = 'to_contact' THEN 1 ELSE 0 END) as to_contact_count, " +
      "SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count, " +
      "SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count, " +
      "SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count, " +
      "SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count, " +
      'COUNT(*) as total_count FROM service_requests';

    const counts = await c.env.DB.prepare(countSql).first();

    return c.json({
      success: true,
      data: result.results,
      counts: {
        to_contact: (counts as any)?.to_contact_count || 0,
        confirmed: (counts as any)?.confirmed_count || 0,
        processing: (counts as any)?.processing_count || 0,
        closed: (counts as any)?.closed_count || 0,
        cancelled: (counts as any)?.cancelled_count || 0,
        total: (counts as any)?.total_count || 0
      }
    });
  } catch (error: any) {
    console.error('Admin get requests error:', error);
    return c.json({ success: false, message: '讀取申請單失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// 3. 站所人員更新內部備註 (Ep03: 防繞過機制 Anti-Bypass Guard)
// 嚴格禁止透過通用 PATCH 修改 status 欄位，所有生命週期變更必須透過專用端點
app.patch('/api/admin/requests/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const rawBody = await c.req.json<any>().catch(() => ({}));

    // Case R: 嘗試透過通用 PATCH 修改 status 必須嚴格拒絕 (400 Bad Request)
    if (rawBody.status !== undefined) {
      return c.json({
        success: false,
        code: 'STATUS_MUTATION_FORBIDDEN',
        message: '禁止透過通用介面修改案件狀態。請使用專屬排程或生命週期管理功能（確認排程、開始施工、結案、改期或取消）。'
      }, 400);
    }

    if (rawBody.admin_memo !== undefined) {
      if (rawBody.admin_memo && rawBody.admin_memo.length > 1000) {
        return c.json({ success: false, message: '管理備註長度不能超過 1000 個字' }, 400);
      }
      const now = new Date().toISOString();
      await c.env.DB.prepare('UPDATE service_requests SET admin_memo = ?, updated_at = ? WHERE id = ?')
        .bind(rawBody.admin_memo, now, id)
        .run();
    }

    return c.json({ success: true, message: '備註已更新' });
  } catch (error: any) {
    console.error('Admin update request memo error:', error);
    return c.json({ success: false, message: '更新失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// Ep03: 專用開工時間白名單檢驗
const VALID_START_TIMES = {
  morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
  afternoon: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
};

function isValidStartTime(slotCode: 'morning' | 'afternoon', timeStr: string): boolean {
  return VALID_START_TIMES[slotCode]?.includes(timeStr) || false;
}

// 3.1 管理員電話確認排程端點 (POST /api/admin/requests/:id/confirm)
// 支援待聯絡 (to_contact) 轉已確認 (confirmed)，以及舊 processing 案件補建排程過渡確認
app.post('/api/admin/requests/:id/confirm', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{
      booking_date: string;
      slot_code: 'morning' | 'afternoon';
      scheduled_start_time: string;
      admin_memo?: string;
      customer_notice?: string;
    }>().catch(() => ({} as any));

    const { booking_date, slot_code, scheduled_start_time, admin_memo, customer_notice } = body;

    if (!booking_date || !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
      return c.json({ success: false, message: '請指定有效的正式服務日期 (YYYY-MM-DD)' }, 400);
    }
    if (slot_code !== 'morning' && slot_code !== 'afternoon') {
      return c.json({ success: false, message: '正式時段必須為上午 (morning) 或下午 (afternoon)' }, 400);
    }
    if (!scheduled_start_time || !isValidStartTime(slot_code, scheduled_start_time)) {
      return c.json({
        success: false,
        message: '預定開工時間不合法。上午限 08:00～11:30、下午限 13:00～17:00 (30分鐘間隔)，12:00 與 12:30 午休不開放。'
      }, 400);
    }

    // 檢查目標時段可用性 (管理員身份 isAdmin: true，不受 lead_time 限制，窗口至 T+60)
    const slotCheck = await isSlotAvailable(c.env.DB, booking_date, slot_code, new Date(), true);
    if (!slotCheck.available) {
      return c.json({
        success: false,
        code: 'SLOT_COLLISION',
        message: '該日期時段已被其他案件預約或已封鎖，無法確認排程。'
      }, 409);
    }

    // 查驗案件當前狀態與是否存在 active reservation
    const req = await c.env.DB.prepare('SELECT * FROM service_requests WHERE id = ?').bind(id).first<any>();
    if (!req) {
      return c.json({ success: false, message: '找不到此預約申請案件' }, 404);
    }

    // 重複確認或非法狀態防護 (Case Q, Case G)
    if (req.status !== 'to_contact' && req.status !== 'processing') {
      return c.json({
        success: false,
        code: 'INVALID_STATUS',
        message: `案件當前狀態為 ${req.status}，無法執行確認排程。已確認案件請使用改期功能。`
      }, 400);
    }

    const existingActive = await c.env.DB.prepare(
      "SELECT id FROM slot_reservations WHERE request_id = ? AND status = 'active'"
    ).bind(id).first<any>();

    if (existingActive) {
      return c.json({
        success: false,
        code: 'ALREADY_CONFIRMED',
        message: '此案件已有正式確認的排程預約，若需調整時間請使用「改期」功能。'
      }, 400);
    }

    const reservationId = 'RSV-' + booking_date.replace(/-/g, '') + '-' + crypto.randomUUID().slice(0, 8);
    const nowIso = new Date().toISOString();
    const cleanCustomerNotice = customer_notice && customer_notice.trim() ? customer_notice.trim() : null;

    // D1 Batch / 條件式更新 (Anti-Orphan Protection)
    const updateReqStmt = c.env.DB.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', 
          admin_memo = COALESCE(?, admin_memo),
          updated_at = ?
      WHERE id = ? AND (
        status = 'to_contact' OR 
        (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
      )
    `).bind(admin_memo ?? null, nowIso, id, id);

    const insertRsvStmt = c.env.DB.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at, notes)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(reservationId, id, booking_date, slot_code, scheduled_start_time, nowIso, cleanCustomerNotice);

    try {
      const batchRes = await c.env.DB.batch([updateReqStmt, insertRsvStmt]);
      const updateResult = batchRes[0];
      if (updateResult.meta && (updateResult.meta as any).changes === 0) {
        return c.json({
          success: false,
          code: 'CONDITION_FAILED',
          message: '案件狀態已被變更或已存在排程，確認失敗。'
        }, 409);
      }
    } catch (batchErr: any) {
      console.error('Batch confirm collision error:', batchErr);
      return c.json({
        success: false,
        code: 'SLOT_COLLISION',
        message: '確認失敗：時段已被其他案件預約或發生資料碰撞。'
      }, 409);
    }

    // 副作用：非同步嘗試發送 LINE 確認通知 (通知失敗絕不回滾 Reservation)
    let linePushSent = false;
    if (c.env.LINE_CHANNEL_ACCESS_TOKEN && req.line_user_id) {
      try {
        const card = generateScheduledConfirmationFlex(
          req,
          { booking_date, slot_code, scheduled_start_time, notes: cleanCustomerNotice || undefined },
          c.env.LIFF_ID,
          c.env.STATION_NAME
        );
        c.executionCtx.waitUntil(
          pushLineMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, req.line_user_id, card)
        );
        linePushSent = true;
      } catch (pushErr) {
        console.warn('Confirm LINE push notification skipped/failed:', pushErr);
      }
    }

    return c.json({
      success: true,
      message: '排程已成功確認！',
      data: {
        reservation_id: reservationId,
        booking_date,
        slot_code,
        scheduled_start_time,
        status: 'confirmed',
        customer_notice: cleanCustomerNotice,
        notification_sent: linePushSent
      }
    });
  } catch (err: any) {
    console.error('Confirm endpoint exception:', err);
    return c.json({ success: false, message: err.message || '伺服器發生暫時性錯誤' }, 500);
  }
});

// 3.2 開始施工端點 (POST /api/admin/requests/:id/start-work)
// 狀態由 confirmed 轉 processing，保留 active reservation
app.post('/api/admin/requests/:id/start-work', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ admin_memo?: string }>().catch(() => ({} as { admin_memo?: string }));
    const nowIso = new Date().toISOString();

    const req = await c.env.DB.prepare('SELECT status FROM service_requests WHERE id = ?').bind(id).first<any>();
    if (!req) return c.json({ success: false, message: '找不到此案件' }, 404);

    if (req.status !== 'confirmed') {
      return c.json({
        success: false,
        code: 'INVALID_STATUS',
        message: `僅有已確認 (confirmed) 案件可進入施工處理中。當前狀態為 ${req.status}。`
      }, 400);
    }

    await c.env.DB.prepare(`
      UPDATE service_requests 
      SET status = 'processing', 
          admin_memo = COALESCE(?, admin_memo),
          updated_at = ?
      WHERE id = ? AND status = 'confirmed'
    `).bind(body.admin_memo ?? null, nowIso, id).run();

    return c.json({ success: true, message: '案件已標記為施工處理中', status: 'processing' });
  } catch (err: any) {
    console.error('Start work exception:', err);
    return c.json({ success: false, message: '伺服器暫時發生錯誤' }, 500);
  }
});

// 3.3 施工完成結案端點 (POST /api/admin/requests/:id/complete)
// processing (或舊 processing) 轉 closed，保留歷史 reservation
app.post('/api/admin/requests/:id/complete', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ admin_memo?: string }>().catch(() => ({} as { admin_memo?: string }));
    const nowIso = new Date().toISOString();

    const req = await c.env.DB.prepare('SELECT status FROM service_requests WHERE id = ?').bind(id).first<any>();
    if (!req) return c.json({ success: false, message: '找不到此案件' }, 404);

    if (req.status !== 'processing') {
      return c.json({
        success: false,
        code: 'INVALID_STATUS',
        message: `僅有處理中 (processing) 案件可結案。當前狀態為 ${req.status}。`
      }, 400);
    }

    await c.env.DB.prepare(`
      UPDATE service_requests 
      SET status = 'closed', 
          admin_memo = COALESCE(?, admin_memo),
          updated_at = ?
      WHERE id = ? AND status = 'processing'
    `).bind(body.admin_memo ?? null, nowIso, id).run();

    return c.json({ success: true, message: '案件已結案', status: 'closed' });
  } catch (err: any) {
    console.error('Complete exception:', err);
    return c.json({ success: false, message: '伺服器暫時發生錯誤' }, 500);
  }
});

// 3.4 原子改期端點 (POST /api/admin/requests/:id/reschedule)
// 原 active 預約改為 released，插入新 active 預約；若碰撞則整個 batch 失敗且原預約完好
app.post('/api/admin/requests/:id/reschedule', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{
      booking_date: string;
      slot_code: 'morning' | 'afternoon';
      scheduled_start_time: string;
      reason?: string;
      customer_notice?: string;
    }>().catch(() => ({} as any));

    const { booking_date, slot_code, scheduled_start_time, reason, customer_notice } = body;

    if (!booking_date || !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
      return c.json({ success: false, message: '請指定有效的改期日期 (YYYY-MM-DD)' }, 400);
    }
    if (slot_code !== 'morning' && slot_code !== 'afternoon') {
      return c.json({ success: false, message: '正式時段必須為上午 (morning) 或下午 (afternoon)' }, 400);
    }
    if (!scheduled_start_time || !isValidStartTime(slot_code, scheduled_start_time)) {
      return c.json({
        success: false,
        message: '預定開工時間不合法。上午限 08:00～11:30、下午限 13:00～17:00 (30分鐘間隔)，12:00 與 12:30 午休不開放。'
      }, 400);
    }

    const req = await c.env.DB.prepare('SELECT * FROM service_requests WHERE id = ?').bind(id).first<any>();
    if (!req) return c.json({ success: false, message: '找不到此案件' }, 404);

    if (req.status !== 'confirmed') {
      return c.json({
        success: false,
        code: 'INVALID_STATUS',
        message: `僅有已確認 (confirmed) 案件可進行改期。當前狀態為 ${req.status}。`
      }, 400);
    }

    const currentRsv = await c.env.DB.prepare(
      "SELECT * FROM slot_reservations WHERE request_id = ? AND status = 'active'"
    ).bind(id).first<any>();

    if (!currentRsv) {
      return c.json({
        success: false,
        code: 'NO_ACTIVE_RESERVATION',
        message: '找不到此案件目前的有效排程預約，無法改期。'
      }, 400);
    }

    // 檢查新時段是否可用 (排除自己當前的時段)
    if (currentRsv.booking_date !== booking_date || currentRsv.slot_code !== slot_code) {
      const slotCheck = await isSlotAvailable(c.env.DB, booking_date, slot_code, new Date(), true);
      if (!slotCheck.available) {
        return c.json({
          success: false,
          code: 'SLOT_COLLISION',
          message: '目標新時段已被其他案件預約或已封鎖，改期失敗。'
        }, 409);
      }
    }

    const newReservationId = 'RSV-' + booking_date.replace(/-/g, '') + '-' + crypto.randomUUID().slice(0, 8);
    const nowIso = new Date().toISOString();
    const cleanCustomerNotice = customer_notice && customer_notice.trim() ? customer_notice.trim() : null;

    // D1 Batch 原子改期：
    // 1. 將舊預約標記為 released
    // 2. 插入新 active 預約
    // 3. 更新 service_requests.updated_at
    const releaseOldStmt = c.env.DB.prepare(`
      UPDATE slot_reservations 
      SET status = 'released', released_at = ?, notes = COALESCE(?, notes)
      WHERE id = ? AND status = 'active'
    `).bind(nowIso, reason ? `改期釋出: ${reason}` : '改期釋出', currentRsv.id);

    const insertNewStmt = c.env.DB.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at, notes)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(newReservationId, id, booking_date, slot_code, scheduled_start_time, nowIso, cleanCustomerNotice);

    const updateReqStmt = c.env.DB.prepare(`
      UPDATE service_requests SET updated_at = ? WHERE id = ? AND status = 'confirmed'
    `).bind(nowIso, id);

    try {
      const batchRes = await c.env.DB.batch([releaseOldStmt, insertNewStmt, updateReqStmt]);
      const releaseResult = batchRes[0];
      if (releaseResult.meta && (releaseResult.meta as any).changes === 0) {
        return c.json({
          success: false,
          code: 'RELEASE_FAILED',
          message: '原預約狀態已改變，改期終止。'
        }, 409);
      }
    } catch (batchErr: any) {
      console.error('Batch reschedule collision error:', batchErr);
      return c.json({
        success: false,
        code: 'SLOT_COLLISION',
        message: '改期失敗：目標新時段已被占用。原預約依然保持有效。'
      }, 409);
    }

    // 副作用：非同步推送改期確認通知
    if (c.env.LINE_CHANNEL_ACCESS_TOKEN && req.line_user_id) {
      try {
        const card = generateScheduledConfirmationFlex(
          req,
          { booking_date, slot_code, scheduled_start_time, notes: cleanCustomerNotice || undefined },
          c.env.LIFF_ID,
          c.env.STATION_NAME,
          true
        );
        c.executionCtx.waitUntil(
          pushLineMessage(c.env.LINE_CHANNEL_ACCESS_TOKEN, req.line_user_id, card)
        );
      } catch (pushErr) {
        console.warn('Reschedule LINE push notification error:', pushErr);
      }
    }

    return c.json({
      success: true,
      message: '改期成功！',
      data: {
        old_reservation_id: currentRsv.id,
        new_reservation_id: newReservationId,
        booking_date,
        slot_code,
        scheduled_start_time,
        customer_notice: cleanCustomerNotice
      }
    });
  } catch (err: any) {
    console.error('Reschedule endpoint exception:', err);
    return c.json({ success: false, message: err.message || '伺服器發生暫時性錯誤' }, 500);
  }
});

// 3.5 取消案件與釋放時段端點 (POST /api/admin/requests/:id/cancel)
// 案件狀態轉 cancelled，關聯 active reservation (若有) 改為 released 釋放時段
app.post('/api/admin/requests/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }));
    const nowIso = new Date().toISOString();

    const req = await c.env.DB.prepare('SELECT * FROM service_requests WHERE id = ?').bind(id).first<any>();
    if (!req) return c.json({ success: false, message: '找不到此案件' }, 404);

    if (req.status === 'closed' || req.status === 'cancelled') {
      return c.json({
        success: false,
        code: 'ALREADY_TERMINATED',
        message: `案件已處於終態 (${req.status})，無法取消。`
      }, 400);
    }

    const cancelReqStmt = c.env.DB.prepare(`
      UPDATE service_requests 
      SET status = 'cancelled', 
          admin_memo = CASE 
            WHEN ? IS NOT NULL THEN COALESCE(admin_memo || ' | 取消原因: ' || ?, '取消原因: ' || ?) 
            ELSE admin_memo 
          END,
          updated_at = ?
      WHERE id = ? AND status IN ('to_contact', 'confirmed', 'processing')
    `).bind(body.reason ?? null, body.reason ?? null, body.reason ?? null, nowIso, id);

    const releaseRsvStmt = c.env.DB.prepare(`
      UPDATE slot_reservations 
      SET status = 'released', released_at = ?, notes = COALESCE(?, notes)
      WHERE request_id = ? AND status = 'active'
    `).bind(nowIso, body.reason ? `案件取消釋出: ${body.reason}` : '案件取消釋出', id);

    await c.env.DB.batch([cancelReqStmt, releaseRsvStmt]);

    return c.json({ success: true, message: '案件已取消，時段已成功釋放', status: 'cancelled' });
  } catch (err: any) {
    console.error('Cancel endpoint exception:', err);
    return c.json({ success: false, message: '伺服器暫時發生錯誤' }, 500);
  }
});

// 4. 取得手動關閉日期 (相容舊版端點，同時讀取 blocked_dates)
app.get('/api/config/blocked-dates', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT date, reason FROM blocked_dates ORDER BY date ASC').all();
    return c.json({ success: true, data: result.results });
  } catch (error: any) {
    console.error('Config get blocked dates error:', error);
    return c.json({ success: false, message: '讀取封閉日期失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// 5. 站所手動關閉/開啟特定日期 (舊端點，由觸發器自動雙向同步至 availability_exceptions)
app.post('/api/admin/blocked-dates', async (c) => {
  try {
    const { date, reason, action } = await c.req.json<{ date: string; reason?: string; action: 'block' | 'unblock' }>();
    if (!date) return c.json({ success: false, message: '請指定日期' }, 400);

    if (action === 'unblock') {
      await c.env.DB.prepare('DELETE FROM blocked_dates WHERE date = ?').bind(date).run();
      return c.json({ success: true, message: '已取消關閉 ' + date });
    } else {
      const now = new Date().toISOString();
      const insertBlocked = 'INSERT OR REPLACE INTO blocked_dates (date, reason, created_at) VALUES (?, ?, ?)';
      await c.env.DB.prepare(insertBlocked).bind(date, reason || '當日服務站調配額滿', now).run();
      return c.json({ success: true, message: '已手動關閉 ' + date });
    }
  } catch (error: any) {
    console.error('Admin toggle blocked date error:', error);
    return c.json({ success: false, message: '調整封閉日期失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// ====================================================================
// Ep03-5: 合作社營業時段設定與例外封鎖專用 API (Merchant Availability Settings)
// ====================================================================

// 5.1 讀取合作社可用性總體設定 (Rules, Exceptions, Config)
app.get('/api/admin/availability-settings', async (c) => {
  try {
    // 讀取系統設定 (mode, lead_time_days, booking_horizon_days)
    const configRes = await c.env.DB.prepare('SELECT key, value FROM availability_config').all<{ key: string; value: string }>();
    const config: Record<string, string> = {};
    for (const row of configRes.results || []) {
      config[row.key] = row.value;
    }

    // 讀取每週循環規則 (0~6 上下午共 14 筆)
    const rulesRes = await c.env.DB.prepare('SELECT * FROM availability_rules ORDER BY day_of_week ASC, slot_code ASC').all<any>();

    // 讀取所有例外封鎖 (未來或全部)
    const exceptionsRes = await c.env.DB.prepare('SELECT * FROM availability_exceptions ORDER BY exception_date ASC, slot_code ASC').all<any>();

    return c.json({
      success: true,
      data: {
        config: {
          mode: config.mode || 'legacy',
          lead_time_days: parseInt(config.lead_time_days || '1', 10),
          booking_horizon_days: parseInt(config.booking_horizon_days || '30', 10)
        },
        rules: rulesRes.results || [],
        exceptions: exceptionsRes.results || []
      }
    });
  } catch (error: any) {
    console.error('Get availability settings error:', error);
    return c.json({ success: false, message: '讀取排程設定失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// 5.2 儲存每週循環開放規則並切換為 Managed 模式 (Case U)
app.put('/api/admin/availability-rules', async (c) => {
  try {
    const body = await c.req.json<{
      rules: Array<{ day_of_week: number; slot_code: 'morning' | 'afternoon'; is_enabled: number }>;
      lead_time_days?: number;
      booking_horizon_days?: number;
    }>().catch(() => ({} as any));

    const { rules, lead_time_days, booking_horizon_days } = body;

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return c.json({ success: false, message: '請提供有效的每週規則清單' }, 400);
    }

    // 防禦性檢查：首次儲存時不得預設關閉全部時段 (Fail-Closed UX Guard)
    const anyEnabled = rules.some(r => r.is_enabled === 1);
    if (!anyEnabled) {
      return c.json({ success: false, message: '不得將全週所有時段全部停用，請至少開放一個時段以供服務預約。' }, 400);
    }

    const nowIso = new Date().toISOString();
    const statements: any[] = [];

    // 批次 upsert availability_rules
    for (const r of rules) {
      if (r.day_of_week < 0 || r.day_of_week > 6 || (r.slot_code !== 'morning' && r.slot_code !== 'afternoon')) {
        continue;
      }
      const ruleId = `rule_${r.day_of_week}_${r.slot_code}`;
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO availability_rules (id, day_of_week, slot_code, is_enabled, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(day_of_week, slot_code) DO UPDATE SET
            is_enabled = excluded.is_enabled,
            updated_at = excluded.updated_at
        `).bind(ruleId, r.day_of_week, r.slot_code, r.is_enabled ? 1 : 0, nowIso)
      );
    }

    // 將模式設定為 managed
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO availability_config (key, value, updated_at) VALUES ('mode', 'managed', ?)
        ON CONFLICT(key) DO UPDATE SET value = 'managed', updated_at = excluded.updated_at
      `).bind(nowIso)
    );

    if (lead_time_days !== undefined && lead_time_days >= 0) {
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO availability_config (key, value, updated_at) VALUES ('lead_time_days', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).bind(String(lead_time_days), nowIso)
      );
    }

    if (booking_horizon_days !== undefined && booking_horizon_days > 0) {
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO availability_config (key, value, updated_at) VALUES ('booking_horizon_days', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).bind(String(booking_horizon_days), nowIso)
      );
    }

    await c.env.DB.batch(statements);

    return c.json({
      success: true,
      message: '每週營業時段設定已儲存，系統已切換為 Managed 模式！',
      mode: 'managed'
    });
  } catch (error: any) {
    console.error('Update availability rules error:', error);
    return c.json({ success: false, message: '儲存每週規則失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// 5.3 檢查日期封鎖時段衝突 (Case L) - 若已有 active reservation，發出警告但不自動取消
app.get('/api/admin/availability-exceptions/check-conflict', async (c) => {
  try {
    const date = c.req.query('date');
    const slotCode = c.req.query('slot_code') || 'all';

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ success: false, message: '請指定有效日期 (YYYY-MM-DD)' }, 400);
    }

    let sql = "SELECT r.id as reservation_id, r.request_id, r.slot_code, r.scheduled_start_time, req.contact_name, req.phone, req.service_type " +
      "FROM slot_reservations r " +
      "JOIN service_requests req ON r.request_id = req.id " +
      "WHERE r.booking_date = ? AND r.status = 'active'";
    const params: any[] = [date];

    if (slotCode === 'morning' || slotCode === 'afternoon') {
      sql += ' AND r.slot_code = ?';
      params.push(slotCode);
    }

    const conflicts = await c.env.DB.prepare(sql).bind(...params).all<any>();
    const count = conflicts.results?.length || 0;

    return c.json({
      success: true,
      has_conflict: count > 0,
      conflict_count: count,
      conflicts: conflicts.results || [],
      warning: count > 0 ? `該日期/時段已有 ${count} 筆正式確認的預約排程！封鎖不會自動取消既有預約，但農友端將無法再預約該時段。` : null
    });
  } catch (error: any) {
    console.error('Check exception conflict error:', error);
    return c.json({ success: false, message: '衝突檢查失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// 5.4 新增例外封鎖 (Availability Exception)
app.post('/api/admin/availability-exceptions', async (c) => {
  try {
    const body = await c.req.json<{
      exception_date: string;
      slot_code: 'all' | 'morning' | 'afternoon';
      reason?: string;
    }>().catch(() => ({} as any));

    const { exception_date, slot_code, reason } = body;

    if (!exception_date || !/^\d{4}-\d{2}-\d{2}$/.test(exception_date)) {
      return c.json({ success: false, message: '請指定有效日期 (YYYY-MM-DD)' }, 400);
    }
    if (!['all', 'morning', 'afternoon'].includes(slot_code)) {
      return c.json({ success: false, message: '時段必須為 all、morning 或 afternoon' }, 400);
    }

    const nowIso = new Date().toISOString();
    const exceptionId = 'ex_' + exception_date.replace(/-/g, '') + '_' + slot_code;

    // 寫入 availability_exceptions
    await c.env.DB.prepare(`
      INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(exception_date, slot_code) DO UPDATE SET
        reason = excluded.reason
    `).bind(exceptionId, exception_date, slot_code, reason || '服務站暫停服務', nowIso).run();

    // 若為全天 (all) 封鎖，同步相容寫入舊 blocked_dates 表
    if (slot_code === 'all') {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO blocked_dates (date, reason, created_at)
        VALUES (?, ?, ?)
      `).bind(exception_date, reason || '服務站暫停服務', nowIso).run();
    }

    return c.json({
      success: true,
      message: `已成功封鎖 ${exception_date} (${slot_code === 'all' ? '全天' : slot_code === 'morning' ? '上午' : '下午'})`,
      id: exceptionId
    });
  } catch (error: any) {
    console.error('Create availability exception error:', error);
    return c.json({ success: false, message: '新增例外封鎖失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// 5.5 刪除例外封鎖 (解除封鎖)
app.delete('/api/admin/availability-exceptions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT * FROM availability_exceptions WHERE id = ?').bind(id).first<any>();
    if (!existing) {
      return c.json({ success: false, message: '找不到此例外封鎖紀錄' }, 404);
    }

    await c.env.DB.prepare('DELETE FROM availability_exceptions WHERE id = ?').bind(id).run();

    // 若為全天封鎖，同步從舊 blocked_dates 刪除
    if (existing.slot_code === 'all') {
      await c.env.DB.prepare('DELETE FROM blocked_dates WHERE date = ?').bind(existing.exception_date).run();
    }

    return c.json({ success: true, message: `已成功解除 ${existing.exception_date} 封鎖` });
  } catch (error: any) {
    console.error('Delete availability exception error:', error);
    return c.json({ success: false, message: '解除封鎖失敗，伺服器暫時發生錯誤' }, 500);
  }
});

// 6. LINE Messaging API Webhook 端點 (處理農友在 LINE 聊天室內查詢預約進度或 Rich Menu 點擊)
app.get('/api/line/webhook', (c) => {
  return c.text('LINE Webhook is active', 200);
});

app.post('/api/line/webhook', async (c) => {
  try {
    const rawBody = await c.req.text();
    console.log('[LINE Webhook] Received request, payload length:', rawBody.length);
    
    // 0. LINE 官方 Webhook 簽名驗證 (HMAC-SHA256 密碼學防偽驗簽，強制 Fail-Closed)
    const channelSecret = c.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) {
      console.error('[LINE Webhook 安全阻擋] 系統未配置 LINE_CHANNEL_SECRET，依據安全標準拒絕處理所有 Webhook 事件');
      return c.text('Server Configuration Error: LINE_CHANNEL_SECRET is required to verify webhook signatures. Please configure LINE_CHANNEL_SECRET in Wrangler.', 503);
    }

    const signature = c.req.header('x-line-signature');
    if (!signature) {
      console.warn('[LINE Webhook 安全阻擋] 缺少 x-line-signature 標頭，拒絕處理 (HTTP 401)');
      return c.text('Missing signature', 401);
    }

    const isValid = await verifyLineSignature(rawBody, signature, channelSecret);
    if (!isValid) {
      console.warn('[LINE Webhook 安全阻擋] x-line-signature 簽名校驗失敗，可能為偽造請求 (HTTP 401)');
      return c.text('Invalid signature', 401);
    }

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.warn('Failed to parse Webhook JSON');
    }
    
    const events: any[] = body.events || [];

    if (!events.length) {
      console.log('LINE Webhook: Empty events (Verify request)');
      return c.text('OK', 200);
    }

    const token = c.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    if (!token) {
      console.error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
      return c.text('OK', 200);
    }

    for (const event of events) {
      const replyToken = event.replyToken;
      const userId = event.source?.userId;
      const maskedUserId = userId && userId.length > 8 ? userId.slice(0, 4) + '***' + userId.slice(-4) : 'anonymous';
      console.log('[LINE Event] type:', event.type, 'from:', maskedUserId);
      if (!replyToken) {
        console.warn('Skipping event without replyToken');
        continue;
      }

      let isQuery = false;
      let isBooking = false;
      let isAdminCmd = false;

      if (event.type === 'message' && event.message?.type === 'text') {
        const text = (event.message.text || '').trim();

        if (/^(管理|後台|管理後台|站所管理|幹部管理|admin|dashboard)$/i.test(text) || text === '管理' || text === '後台') {
          isAdminCmd = true;
        } else if (
          text.includes('查') ||
          text.includes('進度') ||
          text.includes('單號') ||
          text.includes('紀錄') ||
          text.includes('狀態') ||
          /^(query|status|list)$/i.test(text)
        ) {
          isQuery = true;
        } else if (
          text.includes('預約') ||
          text.includes('申請') ||
          text.includes('粉碎') ||
          text.includes('代耕') ||
          /^(book|apply)$/i.test(text)
        ) {
          isBooking = true;
        }
        const intent = isAdminCmd ? 'admin' : isQuery ? 'query' : isBooking ? 'booking' : 'guide';
        console.log('[LINE User Message] intent matched:', intent, 'length:', text.length);
      } else if (event.type === 'postback') {
        const data = event.postback?.data || '';
        if (data.includes('admin')) {
          isAdminCmd = true;
        } else if (data.includes('query')) {
          isQuery = true;
        } else if (data.includes('book')) {
          isBooking = true;
        }
        const postbackAction = isAdminCmd ? 'admin' : isQuery ? 'query' : isBooking ? 'booking' : 'other';
        console.log('[LINE Postback] action matched:', postbackAction);
      }

      if (isAdminCmd) {
        const allowedAdminIds = [
          ...(c.env.ADMIN_LINE_IDS ? c.env.ADMIN_LINE_IDS.split(',').map((s: string) => s.trim()) : []),
          c.env.ADMIN_NOTIFY_USER_ID
        ].filter(Boolean);

        if (userId && allowedAdminIds.includes(userId)) {
          const adminCard = generateAdminPortalFlex(c.env.LIFF_ID, c.env.STATION_NAME);
          await replyLineMessage(token, replyToken, [adminCard]);
        } else {
          const denyCard = {
            type: 'text',
            text: '🔒 您好，此管理指令僅供站所授權服務人員使用。若您有果樹枝條粉碎或代耕預約需求，歡迎點擊下方選單進行線上預約！'
          };
          await replyLineMessage(token, replyToken, [denyCard]);
        }
      } else if (isQuery) {
        // 從資料庫查詢該 LINE 用戶最新的預約紀錄
        let records: any = { results: [] };
        if (userId) {
          // 安全隱私防護：採用欄位白名單投影，嚴格排除 admin_memo 等站所內部機密備註
          // Ep03: 左連接 slot_reservations (status = 'active') 取得正式排程日期與開工時間
          records = await c.env.DB.prepare(
            'SELECT r.id, r.created_at, r.updated_at, r.contact_name, r.service_type, r.crop_type, r.area_size, r.branch_volume, ' +
            'r.location_area, r.location_address, r.preferred_date, r.preferred_time_slot, r.date_flexibility, r.status, ' +
            's.booking_date as scheduled_date, s.slot_code as scheduled_slot_code, s.scheduled_start_time, s.notes as customer_notice ' +
            'FROM service_requests r ' +
            "LEFT JOIN slot_reservations s ON r.id = s.request_id AND s.status = 'active' " +
            'WHERE r.line_user_id = ? ORDER BY r.created_at DESC LIMIT 5'
          ).bind(userId).all();
        }

        console.log('Found records count for query:', records.results?.length || 0);
        const flexMsg = generateProgressQueryFlex(records.results || [], c.env.LIFF_ID, c.env.STATION_NAME);
        await replyLineMessage(token, replyToken, [flexMsg]);
      } else if (isBooking) {
        const bookingCard = {
          type: 'flex',
          altText: '【線上預約】' + (c.env.STATION_NAME || '服務站') + '服務預約',
          contents: {
            type: 'bubble',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#173820',
              paddingAll: '18px',
              contents: [
                { type: 'text', text: '🌱 ' + (c.env.STATION_NAME || '高雄服務站'), color: '#bbf7d0', size: 'xs', weight: 'bold' },
                { type: 'text', text: '📝 線上服務預約申請', color: '#ffffff', size: 'lg', weight: 'bold', margin: 'xs' }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '18px',
              spacing: 'sm',
              contents: [
                { type: 'text', text: '歡迎使用農機枝條粉碎與代耕服務線上預約！', size: 'sm', color: '#20271f', weight: 'bold' },
                { type: 'text', text: '點擊下方按鈕即可開啟預約表單，填寫作物、面積與希望施工日期，服務站將儘速與您聯繫排程。', size: 'xs', color: '#657061', wrap: true }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '16px',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'uri',
                    label: '🌱 開啟預約申請表',
                    uri: 'https://liff.line.me/' + (c.env.LIFF_ID || '')
                  },
                  style: 'primary',
                  color: '#173820'
                }
              ]
            }
          }
        };

        await replyLineMessage(token, replyToken, [bookingCard]);
      } else {
        // 其他任何訊息（包含打招呼、測試等），主動回覆功能導覽卡片
        const welcomeFlex = generateWelcomeGuideFlex(c.env.LIFF_ID, c.env.STATION_NAME);
        await replyLineMessage(token, replyToken, [welcomeFlex]);
      }
    }

    return c.text('OK', 200);
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return c.text('OK', 200);
  }
});

// 7. 診斷端點：手動推播測試卡片至特定 LINE User ID (納入 /api/admin 權限管轄，需服務人員授權)
app.get('/api/admin/debug/test-card', async (c) => {
  const userId = c.req.query('userId') || c.env.ADMIN_NOTIFY_USER_ID;
  if (!userId) {
    return c.json({ success: false, message: '缺少目標 userId 參數' }, 400);
  }
  const token = c.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return c.json({ success: false, message: '伺服器未配置推播金鑰' }, 500);

  // 安全防護：僅查詢卡片必要顯示欄位，排除內部敏感備註 (admin_memo 等)
  const records = await c.env.DB.prepare(
    'SELECT r.id, r.created_at, r.updated_at, r.contact_name, r.service_type, r.crop_type, r.area_size, r.branch_volume, ' +
    'r.location_area, r.location_address, r.preferred_date, r.preferred_time_slot, r.date_flexibility, r.status, ' +
    's.booking_date as scheduled_date, s.slot_code as scheduled_slot_code, s.scheduled_start_time, s.notes as customer_notice ' +
    'FROM service_requests r ' +
    "LEFT JOIN slot_reservations s ON r.id = s.request_id AND s.status = 'active' " +
    'WHERE r.line_user_id = ? ORDER BY r.created_at DESC LIMIT 5'
  ).bind(userId).all();

  const flexMsg = generateProgressQueryFlex(records.results || [], c.env.LIFF_ID, c.env.STATION_NAME);
  await pushLineMessage(token, userId, flexMsg, c.env.DB);

  // 取得最新一筆 push log
  const lastLog = await c.env.DB.prepare('SELECT * FROM system_push_logs ORDER BY created_at DESC LIMIT 1').first<any>();

  return c.json({
    success: true,
    message: 'Test card push executed',
    recordsCount: records.results?.length || 0,
    pushResult: lastLog
  });
});

export default app;
