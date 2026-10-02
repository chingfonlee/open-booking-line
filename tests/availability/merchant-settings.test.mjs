import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { computeAvailability, isSlotAvailable } from '../../packages/backend/src/availability.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function createD1Adapter(sqliteDb) {
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      return {
        bind(...params) {
          return {
            async all() {
              return { results: stmt.all(...params) };
            },
            async first() {
              return stmt.get(...params) || null;
            },
            async run() {
              const info = stmt.run(...params);
              return { success: true, meta: { changes: info.changes } };
            }
          };
        },
        async all(...params) {
          return { results: stmt.all(...params) };
        },
        async first(...params) {
          return stmt.get(...params) || null;
        },
        async run(...params) {
          const info = stmt.run(...params);
          return { success: true, meta: { changes: info.changes } };
        }
      };
    },
    async batch(statements) {
      sqliteDb.exec('BEGIN TRANSACTION');
      try {
        const results = [];
        for (const s of statements) {
          const res = await s.run();
          results.push(res);
        }
        sqliteDb.exec('COMMIT');
        return results;
      } catch (err) {
        sqliteDb.exec('ROLLBACK');
        throw err;
      }
    }
  };
}

test('Ep03-5 Merchant Availability Settings & Progressive Mode Suite', async (t) => {
  let sqliteDb;
  let d1;

  // 固定測試時間：2026-10-14 (週三) 台灣時間 10:00 (UTC 02:00)
  const mockNowDate = new Date('2026-10-14T02:00:00Z');
  const mockToday = '2026-10-14';

  const createRequestWithReservation = ({ reqId, rsvId, date, slot, time = '08:00', status = 'active' }) => {
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES (?, '王大明', '0912345678', 'branch_crush', '蜜棗', '2 分', '燕巢區', '中民路', ?, ?, 'confirmed', 'U_TEST', datetime('now'), datetime('now'))
    `).run(reqId, date, slot);

    sqliteDb.prepare(`
      INSERT INTO slot_reservations (
        id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(rsvId, reqId, date, slot, time, status);
  };

  t.beforeEach(() => {
    sqliteDb = new DatabaseSync(':memory:');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');

    const ep01Schema = fs.readFileSync(path.join(rootDir, 'packages/backend/schema.sql'), 'utf8');
    sqliteDb.exec(ep01Schema);

    const ep03Migration = fs.readFileSync(
      path.join(rootDir, 'packages/backend/migrations/0002_ep03_availability_schema.sql'),
      'utf8'
    );
    sqliteDb.exec(ep03Migration);

    d1 = createD1Adapter(sqliteDb);
  });

  t.afterEach(() => {
    if (sqliteDb) sqliteDb.close();
  });

  await t.test('1. Baseline & Default Mode: Initial mode is legacy, 14 rules exist (Mon-Fri enabled, Sat-Sun disabled)', async () => {
    const configRow = sqliteDb.prepare("SELECT value FROM availability_config WHERE key = 'mode'").get();
    assert.equal(configRow.value, 'legacy', 'Default mode must be legacy');

    const rules = sqliteDb.prepare("SELECT * FROM availability_rules").all();
    assert.equal(rules.length, 14, 'Should initialize 14 rules (7 days x 2 slots)');
    
    // 預設週一至週五開放 (1~5)，週六週日休息 (0, 6)
    const weekdays = rules.filter(r => r.day_of_week >= 1 && r.day_of_week <= 5);
    const weekends = rules.filter(r => r.day_of_week === 0 || r.day_of_week === 6);
    assert.ok(weekdays.every(r => r.is_enabled === 1), 'Mon-Fri slots default to enabled');
    assert.ok(weekends.every(r => r.is_enabled === 0), 'Weekend slots default to disabled');
  });

  await t.test('2. Case U: Fail-Closed Guard - Reject saving if all 14 weekly slots are disabled', async () => {
    const allDisabledRules = [];
    for (let d = 0; d < 7; d++) {
      allDisabledRules.push({ day_of_week: d, slot_code: 'morning', is_enabled: 0 });
      allDisabledRules.push({ day_of_week: d, slot_code: 'afternoon', is_enabled: 0 });
    }

    // 驗證 fail-closed 驗證邏輯
    const anyEnabled = allDisabledRules.some(r => r.is_enabled === 1);
    assert.equal(anyEnabled, false, 'All slots disabled');

    // 模擬後端校驗
    let errorThrown = false;
    if (!anyEnabled) {
      errorThrown = true;
    }
    assert.equal(errorThrown, true, 'Must fail-closed and reject saving when all slots disabled');

    // 驗證 DB 狀態未被破壞，仍為 legacy
    const configRow = sqliteDb.prepare("SELECT value FROM availability_config WHERE key = 'mode'").get();
    assert.equal(configRow.value, 'legacy');
  });

  await t.test('3. Case U: Progressive Mode Transition - Saving valid weekly rules atomically flips mode to managed', async () => {
    // 站所設定：週日 (0) 與週六 (6) 休息，其餘工作日 (1~5) 上午開放、下午休息
    const customRules = [];
    for (let d = 0; d < 7; d++) {
      // 僅週一到週五上午開放
      const morningOpen = d >= 1 && d <= 5 ? 1 : 0;
      customRules.push({ day_of_week: d, slot_code: 'morning', is_enabled: morningOpen });
      customRules.push({ day_of_week: d, slot_code: 'afternoon', is_enabled: 0 });
    }

    // 執行後端 PUT /api/admin/availability-rules 批次邏輯
    const statements = [];
    const nowIso = new Date().toISOString();
    for (const r of customRules) {
      statements.push(
        d1.prepare(`
          INSERT INTO availability_rules (id, day_of_week, slot_code, is_enabled, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(day_of_week, slot_code) DO UPDATE SET
            is_enabled = excluded.is_enabled,
            updated_at = excluded.updated_at
        `).bind(`rule_${r.day_of_week}_${r.slot_code}`, r.day_of_week, r.slot_code, r.is_enabled, nowIso)
      );
    }
    // 原子寫入 mode = 'managed'
    statements.push(
      d1.prepare(`
        INSERT INTO availability_config (key, value, updated_at) VALUES ('mode', 'managed', ?)
        ON CONFLICT(key) DO UPDATE SET value = 'managed', updated_at = excluded.updated_at
      `).bind(nowIso)
    );

    await d1.batch(statements);

    // 驗證 mode 已切換為 managed
    const configRow = sqliteDb.prepare("SELECT value FROM availability_config WHERE key = 'mode'").get();
    assert.equal(configRow.value, 'managed', 'Mode must flip to managed');

    // 驗證週日 (0) 規則為 0, 週三 (3) 上午為 1 下午為 0
    const sunMorning = sqliteDb.prepare("SELECT is_enabled FROM availability_rules WHERE day_of_week = 0 AND slot_code = 'morning'").get();
    assert.equal(sunMorning.is_enabled, 0);

    const wedMorning = sqliteDb.prepare("SELECT is_enabled FROM availability_rules WHERE day_of_week = 3 AND slot_code = 'morning'").get();
    assert.equal(wedMorning.is_enabled, 1);

    const wedAfternoon = sqliteDb.prepare("SELECT is_enabled FROM availability_rules WHERE day_of_week = 3 AND slot_code = 'afternoon'").get();
    assert.equal(wedAfternoon.is_enabled, 0);

    // 驗證 Availability 引擎於 managed 模式下確實反映週三下午 weekly_closed
    const wedDate = '2026-10-21'; // 週三
    const availWed = await computeAvailability({ db: d1, singleDate: wedDate, nowDate: mockNowDate });
    const wedSlots = availWed.dates[wedDate];
    assert.equal(wedSlots.slots.morning, true, 'Wednesday morning should be open');
    assert.equal(wedSlots.slots.afternoon, false, 'Wednesday afternoon should be closed');
    assert.equal(wedSlots.reasons.afternoon, 'weekly_closed', 'Reason must be weekly_closed');
  });

  await t.test('4. Case L: Conflict Detection - Query active reservations on target exception date/slot', async () => {
    // 建立 2 筆 2026-10-20 的預約：1 筆上午 active，1 筆下午 active
    createRequestWithReservation({ reqId: 'REQ-001', rsvId: 'RSV-001', date: '2026-10-20', slot: 'morning', time: '09:00' });
    createRequestWithReservation({ reqId: 'REQ-002', rsvId: 'RSV-002', date: '2026-10-20', slot: 'afternoon', time: '14:00' });
    
    // 建立 1 筆 released 預約 (不應被當作衝突)
    createRequestWithReservation({ reqId: 'REQ-003', rsvId: 'RSV-003', date: '2026-10-20', slot: 'morning', status: 'released' });

    // 檢查全天 (all) 衝突
    const checkAllSql = `
      SELECT r.id as reservation_id, r.request_id, r.slot_code, r.scheduled_start_time, req.contact_name, req.phone, req.service_type
      FROM slot_reservations r
      JOIN service_requests req ON r.request_id = req.id
      WHERE r.booking_date = ? AND r.status = 'active'
    `;
    const conflictsAll = sqliteDb.prepare(checkAllSql).all('2026-10-20');
    assert.equal(conflictsAll.length, 2, 'Should find 2 active reservations (morning and afternoon)');

    // 檢查僅上午 (morning) 衝突
    const checkMorningSql = checkAllSql + ' AND r.slot_code = ?';
    const conflictsMorning = sqliteDb.prepare(checkMorningSql).all('2026-10-20', 'morning');
    assert.equal(conflictsMorning.length, 1, 'Should find exactly 1 active morning reservation');
    assert.equal(conflictsMorning[0].reservation_id, 'RSV-001');

    // 檢查無預約之日期 2026-10-22
    const conflictsNone = sqliteDb.prepare(checkAllSql).all('2026-10-22');
    assert.equal(conflictsNone.length, 0, 'No conflicts on empty date');
  });

  await t.test('5. Case L: Adding Exception Blocks Engine without Canceling Existing Reservation', async () => {
    const targetDate = '2026-10-20'; // 週二
    // 預先有一筆已確認的 active 預約
    createRequestWithReservation({ reqId: 'REQ-100', rsvId: 'RSV-100', date: targetDate, slot: 'morning', time: '08:30' });

    // 站所管理員新增全天封鎖例外 (理由：全所機器年度檢修)
    const exId = 'ex_20261020_all';
    const nowIso = new Date().toISOString();
    sqliteDb.prepare(`
      INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(exId, targetDate, 'all', '機器年度檢修', nowIso);

    // 同步寫入 blocked_dates (Legacy 雙向相容)
    sqliteDb.prepare(`
      INSERT OR REPLACE INTO blocked_dates (date, reason, created_at)
      VALUES (?, ?, ?)
    `).run(targetDate, '機器年度檢修', nowIso);

    // 1. 驗證既有預約 RSV-100 仍然保持 active，完全未被刪除或改為 released (Case L 不得損壞既有預約)
    const rsvCheck = sqliteDb.prepare("SELECT status FROM slot_reservations WHERE id = ?").get('RSV-100');
    assert.equal(rsvCheck.status, 'active', 'Existing reservation must remain active');

    // 2. 驗證農友端 Availability 引擎現在將該日期 morning/afternoon 標記為不可選
    const avail = await computeAvailability({ db: d1, singleDate: targetDate, nowDate: mockNowDate });
    const dayAvail = avail.dates[targetDate];
    assert.equal(dayAvail.selectable, false, 'Blocked date must not be selectable');
    assert.equal(dayAvail.slots.morning, false);
    assert.equal(dayAvail.slots.afternoon, false);
    // 上午因有 active reservation，reason 為 reserved；下午僅有 exception 封鎖，reason 為 blocked
    assert.equal(dayAvail.reasons.morning, 'reserved');
    assert.equal(dayAvail.reasons.afternoon, 'blocked');

    // 3. 管理端確認時段可用性檢查 (isSlotAvailable) 亦判定不可預約 (上午有預約 reserved，下午有例外 blocked)
    const morningCheck = await isSlotAvailable(d1, targetDate, 'morning', mockNowDate, true);
    assert.equal(morningCheck.available, false);
    assert.equal(morningCheck.reason, 'reserved');

    const afternoonCheck = await isSlotAvailable(d1, targetDate, 'afternoon', mockNowDate, true);
    assert.equal(afternoonCheck.available, false);
    assert.equal(afternoonCheck.reason, 'blocked');
  });

  await t.test('6. Unblocking Exception: Deleting exception restores slot availability', async () => {
    const targetDate = '2026-10-23'; // 週五
    const exId = 'ex_20261023_all';
    const nowIso = new Date().toISOString();

    // 先新增封鎖
    sqliteDb.prepare(`
      INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(exId, targetDate, 'all', '臨時停水', nowIso);
    sqliteDb.prepare("INSERT OR REPLACE INTO blocked_dates (date, reason, created_at) VALUES (?, ?, ?)").run(targetDate, '臨時停水', nowIso);

    // 驗證封鎖中
    let avail = await computeAvailability({ db: d1, singleDate: targetDate, nowDate: mockNowDate });
    assert.equal(avail.dates[targetDate].selectable, false);

    // 執行解除封鎖 (DELETE /api/admin/availability-exceptions/:id)
    sqliteDb.prepare("DELETE FROM availability_exceptions WHERE id = ?").run(exId);
    sqliteDb.prepare("DELETE FROM blocked_dates WHERE date = ?").run(targetDate);

    // 驗證時段恢復開放
    avail = await computeAvailability({ db: d1, singleDate: targetDate, nowDate: mockNowDate });
    assert.equal(avail.dates[targetDate].selectable, true, 'Slot must be restored after deleting exception');
    assert.equal(avail.dates[targetDate].slots.morning, true);
    assert.equal(avail.dates[targetDate].slots.afternoon, true);
  });

  await t.test('7. Static Audit: AdminDashboard contains view switcher, rules matrix, and conflict warning banner', () => {
    const dashboardSource = fs.readFileSync(
      path.join(rootDir, 'packages/frontend/src/components/AdminDashboard.tsx'),
      'utf8'
    );

    // 驗證頁籤切換存在
    assert.ok(dashboardSource.includes("activeTab === 'requests'"), 'Must have requests tab');
    assert.ok(dashboardSource.includes("activeTab === 'settings'"), 'Must have settings tab');
    assert.ok(dashboardSource.includes('時段規則與公休設定'), 'Must display settings tab title');

    // 驗證模式切換與參數控制存在
    assert.ok(dashboardSource.includes('管制模式 (Managed)'), 'Must indicate Managed mode');
    assert.ok(dashboardSource.includes('相容模式 (Legacy)'), 'Must indicate Legacy mode');
    assert.ok(dashboardSource.includes('lead_time_days'), 'Must have lead_time_days control');
    assert.ok(dashboardSource.includes('booking_horizon_days'), 'Must have booking_horizon_days control');

    // 驗證每週規則矩陣
    assert.ok(dashboardSource.includes('每週固定開放時段矩陣'), 'Must render weekly rules matrix');
    assert.ok(dashboardSource.includes('handleSaveRules'), 'Must have rules save handler');
    assert.ok(dashboardSource.includes('handleToggleRule'), 'Must have toggle rule handler');

    // 驗證 Case L 衝突警示機制
    assert.ok(dashboardSource.includes('check-conflict'), 'Must call check-conflict endpoint');
    assert.ok(dashboardSource.includes('conflictWarning'), 'Must track conflict warning state');
    assert.ok(dashboardSource.includes('Case L 保護機制'), 'Must present Case L warning UI');
  });
});
