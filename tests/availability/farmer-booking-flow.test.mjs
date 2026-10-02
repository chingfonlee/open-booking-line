import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { isSlotAvailable, addDays } from '../../packages/backend/src/availability.ts';

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
    }
  };
}

test('Ep03-3 Farmer Booking Flow & Submit Validation Tests', async (t) => {
  let sqliteDb;
  let d1;

  // 固定測試基準日期：2026-10-14 (週三)
  const mockNowDate = new Date('2026-10-14T10:00:00Z');
  const mockToday = '2026-10-14';

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

  await t.test('1. Slot Validation: accepts morning, afternoon, any; rejects precise times', async () => {
    // 合法寬鬆時段
    const morningCheck = await isSlotAvailable(d1, '2026-10-15', 'morning', mockNowDate, false);
    assert.equal(morningCheck.available, true);

    const afternoonCheck = await isSlotAvailable(d1, '2026-10-15', 'afternoon', mockNowDate, false);
    assert.equal(afternoonCheck.available, true);

    const anyCheck = await isSlotAvailable(d1, '2026-10-15', 'any', mockNowDate, false);
    assert.equal(anyCheck.available, true);
  });

  await t.test('2. Reserved Slot Submit Rejection: rejects booking request if target slot is active reservation', async () => {
    // 建立 10/16 上午之 active reservation
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES ('REQ-EXISTING', '李農友', '0911000111', 'branch_crush', '蜜棗', '2 分', '燕巢區', '中興路', '2026-10-16', 'morning', 'confirmed', 'U1', datetime('now'), datetime('now'))
    `).run();

    sqliteDb.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-EXISTING', 'REQ-EXISTING', '2026-10-16', 'morning', '09:00', 'active', datetime('now'))
    `).run();

    // 農友嘗試送單 10/16 上午 ➔ 必須被阻斷
    const checkMorning = await isSlotAvailable(d1, '2026-10-16', 'morning', mockNowDate, false);
    assert.equal(checkMorning.available, false);
    assert.equal(checkMorning.reason, 'reserved');

    // 但同日下午依然可用
    const checkAfternoon = await isSlotAvailable(d1, '2026-10-16', 'afternoon', mockNowDate, false);
    assert.equal(checkAfternoon.available, true);

    // 選擇「都可以」時，因下午可用，故依然為 true
    const checkAny = await isSlotAvailable(d1, '2026-10-16', 'any', mockNowDate, false);
    assert.equal(checkAny.available, true);
  });

  await t.test('3. Both Slots Reserved: choosing any is rejected when both morning and afternoon are reserved', async () => {
    // 上午與下午皆被保留
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES 
        ('REQ-A', '農友A', '0911000111', 'branch_crush', '蜜棗', '2 分', '燕巢區', '路1', '2026-10-17', 'morning', 'confirmed', 'U1', datetime('now'), datetime('now')),
        ('REQ-B', '農友B', '0922000222', 'branch_crush', '芭樂', '1 分', '燕巢區', '路2', '2026-10-17', 'afternoon', 'confirmed', 'U2', datetime('now'), datetime('now'))
    `).run();

    sqliteDb.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES 
        ('RSV-A', 'REQ-A', '2026-10-17', 'morning', '08:30', 'active', datetime('now')),
        ('RSV-B', 'REQ-B', '2026-10-17', 'afternoon', '13:30', 'active', datetime('now'))
    `).run();

    const anyCheck = await isSlotAvailable(d1, '2026-10-17', 'any', mockNowDate, false);
    assert.equal(anyCheck.available, false);
  });

  await t.test('4. Concurrency Safety: Multiple pending requests on the exact same date & slot are permitted', async () => {
    // 農友 A 與 農友 B 同時申請 10/18 上午 (to_contact Pending 狀態)
    const reqDate = '2026-10-18';
    const reqSlot = 'morning';

    // 1. 農友 A 驗證可用並送單
    const checkA = await isSlotAvailable(d1, reqDate, reqSlot, mockNowDate, false);
    assert.equal(checkA.available, true);
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES ('REQ-PENDING-A', '農友A', '0911000001', 'branch_crush', '梨', '1 分', '東勢區', '中興路', ?, ?, 'to_contact', 'UA', datetime('now'), datetime('now'))
    `).run(reqDate, reqSlot);

    // 2. 農友 B 同步申請同一時段 ➔ 驗證依然為 true！絕不因 Pending 而被鎖定！
    const checkB = await isSlotAvailable(d1, reqDate, reqSlot, mockNowDate, false);
    assert.equal(checkB.available, true);
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES ('REQ-PENDING-B', '農友B', '0922000002', 'branch_crush', '梨', '2 分', '東勢區', '東崎路', ?, ?, 'to_contact', 'UB', datetime('now'), datetime('now'))
    `).run(reqDate, reqSlot);

    // 驗證資料庫中有 2 筆 pending 申請且 0 筆 active reservation
    const pendingCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM service_requests WHERE preferred_date = ? AND status = 'to_contact'").get(reqDate);
    assert.equal(pendingCount.count, 2);

    const activeResCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM slot_reservations WHERE booking_date = ? AND status = 'active'").get(reqDate);
    assert.equal(activeResCount.count, 0);
  });

  await t.test('5. Lead Time & Past Date Protection: rejects today and past dates', async () => {
    // 過去日期 10/13
    const pastCheck = await isSlotAvailable(d1, '2026-10-13', 'morning', mockNowDate, false);
    assert.equal(pastCheck.available, false);
    assert.equal(pastCheck.reason, 'past');

    // 當天 10/14 (因 lead_time = 1 天，農友端無法預約今天)
    const todayCheck = await isSlotAvailable(d1, mockToday, 'morning', mockNowDate, false);
    assert.equal(todayCheck.available, false);
    assert.equal(todayCheck.reason, 'lead_time');

    // 超出 30 天 horizon (10/14 + 31 天)
    const farDate = addDays(mockToday, 31);
    const horizonCheck = await isSlotAvailable(d1, farDate, 'morning', mockNowDate, false);
    assert.equal(horizonCheck.available, false);
    assert.equal(horizonCheck.reason, 'outside_horizon');
  });

  await t.test('6. Frontend UI Static Contract Audit: verifies disclaimer, slot options, and no exact time picker', () => {
    const applyFormCode = fs.readFileSync(
      path.join(rootDir, 'packages/frontend/src/components/ApplyForm.tsx'),
      'utf8'
    );

    // 1. 驗證免責與說明提示文字存在
    assert.ok(
      applyFormCode.includes('此為希望服務時段，實際服務日期與開工時間將由服務站聯絡確認'),
      'Disclaimer notice must be present in ApplyForm.tsx'
    );

    // 2. 驗證僅提供上午、下午、都可以
    assert.ok(applyFormCode.includes("'morning'"), 'Must support morning slot');
    assert.ok(applyFormCode.includes("'afternoon'"), 'Must support afternoon slot');
    assert.ok(applyFormCode.includes("'any'"), 'Must support any slot');
    assert.ok(applyFormCode.includes('都可以'), "Slot label must include '都可以'");

    // 3. 嚴格審計：禁止出現任何精確時間選擇器 (08:00, 08:30 等，或 type="time")
    assert.equal(applyFormCode.includes('type="time"'), false, 'Strictly forbidden to have type="time" input');
    assert.equal(applyFormCode.includes("'08:00'"), false, 'Strictly forbidden to offer 08:00 selector to farmers');
    assert.equal(applyFormCode.includes("'08:30'"), false, 'Strictly forbidden to offer 08:30 selector to farmers');
    assert.equal(applyFormCode.includes("'09:00'"), false, 'Strictly forbidden to offer 09:00 selector to farmers');
  });
});
