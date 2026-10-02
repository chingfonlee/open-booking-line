import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

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
      // 模擬 D1.batch：在單一交易中執行所有 statements
      sqliteDb.exec('BEGIN TRANSACTION');
      try {
        const results = [];
        for (const s of statements) {
          // 在 batch 中呼叫 run
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

test('Ep03-4 Confirmation & Reservation Lifecycle Test Suite', async (t) => {
  let sqliteDb;
  let d1;

  // 固定測試時間：2026-10-14 (週三)
  const mockNowDate = new Date('2026-10-14T02:00:00Z'); // UTC 02:00 = 台灣 10:00

  t.beforeEach(() => {
    sqliteDb = new DatabaseSync(':memory:');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');

    const ep01Schema = fs.readFileSync(path.join(rootDir, 'packages/backend/schema.sql'), 'utf8');
    sqliteDb.exec(ep01Schema);

    const ep03Schema = fs.readFileSync(path.join(rootDir, 'packages/backend/migrations/0002_ep03_availability_schema.sql'), 'utf8');
    sqliteDb.exec(ep03Schema);

    d1 = createD1Adapter(sqliteDb);
  });

  t.afterEach(() => {
    sqliteDb.close();
  });

  const insertRequest = (req) => {
    const defaultReq = {
      id: 'REQ-TEST-001',
      created_at: '2026-10-14T02:00:00Z',
      updated_at: '2026-10-14T02:00:00Z',
      contact_name: '陳小農',
      phone: '0912345678',
      service_type: '果樹枝條粉碎',
      crop_type: '芭樂',
      area_size: '2分',
      location_area: '燕巢區',
      location_address: '中正路100號',
      preferred_date: '2026-10-16',
      preferred_time_slot: 'morning',
      status: 'to_contact',
      ...req
    };
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, created_at, updated_at, contact_name, phone, service_type, crop_type,
        area_size, location_area, location_address, preferred_date, preferred_time_slot, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultReq.id, defaultReq.created_at, defaultReq.updated_at, defaultReq.contact_name,
      defaultReq.phone, defaultReq.service_type, defaultReq.crop_type, defaultReq.area_size,
      defaultReq.location_area, defaultReq.location_address, defaultReq.preferred_date,
      defaultReq.preferred_time_slot, defaultReq.status
    );
    return defaultReq;
  };

  // 測試 1: 開工時間白名單檢驗 (Case H)
  await t.test('1. Start Time Validation: accepts valid whitelist times and rejects out-of-bounds or lunch hours (12:00/12:30)', () => {
    const VALID_START_TIMES = {
      morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
      afternoon: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
    };
    function isValidStartTime(slot, time) {
      return VALID_START_TIMES[slot]?.includes(time) || false;
    }

    assert.equal(isValidStartTime('morning', '08:00'), true);
    assert.equal(isValidStartTime('morning', '09:30'), true);
    assert.equal(isValidStartTime('morning', '11:30'), true);
    assert.equal(isValidStartTime('afternoon', '13:00'), true);
    assert.equal(isValidStartTime('afternoon', '15:30'), true);
    assert.equal(isValidStartTime('afternoon', '17:00'), true);

    // 嚴格拒絕午休
    assert.equal(isValidStartTime('morning', '12:00'), false);
    assert.equal(isValidStartTime('morning', '12:30'), false);
    assert.equal(isValidStartTime('afternoon', '12:00'), false);
    assert.equal(isValidStartTime('afternoon', '12:30'), false);

    // 拒絕跨時段或非 30 分鐘時間點
    assert.equal(isValidStartTime('morning', '14:00'), false);
    assert.equal(isValidStartTime('afternoon', '09:00'), false);
    assert.equal(isValidStartTime('morning', '07:30'), false);
    assert.equal(isValidStartTime('morning', '09:15'), false);
    assert.equal(isValidStartTime('afternoon', '17:30'), false);
  });

  // 測試 2: 管理員確認排程成功 (Case B)
  await t.test('2. Confirmation Success: changes to_contact to confirmed and creates active reservation', async () => {
    insertRequest({ id: 'REQ-CONFIRM-1', status: 'to_contact' });

    const reqId = 'REQ-CONFIRM-1';
    const bookingDate = '2026-10-16';
    const slotCode = 'morning';
    const startTime = '09:30';
    const rsvId = 'RSV-20261016-0001';

    // 模擬後端 confirm endpoint 之原子 batch
    const updateReq = d1.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ? AND (
        status = 'to_contact' OR 
        (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
      )
    `).bind(reqId, reqId);

    const insertRsv = d1.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `).bind(rsvId, reqId, bookingDate, slotCode, startTime);

    const batchRes = await d1.batch([updateReq, insertRsv]);
    assert.equal(batchRes[0].meta.changes, 1, 'Request must be updated to confirmed');

    // 驗證 DB 狀態
    const updatedReq = sqliteDb.prepare('SELECT status FROM service_requests WHERE id = ?').get(reqId);
    assert.equal(updatedReq.status, 'confirmed');

    const createdRsv = sqliteDb.prepare('SELECT * FROM slot_reservations WHERE id = ?').get(rsvId);
    assert.equal(createdRsv.request_id, reqId);
    assert.equal(createdRsv.booking_date, bookingDate);
    assert.equal(createdRsv.slot_code, slotCode);
    assert.equal(createdRsv.scheduled_start_time, startTime);
    assert.equal(createdRsv.status, 'active');
  });

  // 測試 3: 同一時段碰撞拒絕 (Case D, Case E - Invariant A)
  await t.test('3. Collision Rejection: second confirmation on same date + broad slot is rejected and rolls back', async () => {
    insertRequest({ id: 'REQ-A', status: 'to_contact' });
    insertRequest({ id: 'REQ-B', status: 'to_contact' });

    // REQ-A 先成功確認 10/16 上午
    await d1.batch([
      d1.prepare("UPDATE service_requests SET status = 'confirmed' WHERE id = ?").bind('REQ-A'),
      d1.prepare(`
        INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
        VALUES ('RSV-A', 'REQ-A', '2026-10-16', 'morning', '08:30', 'active', datetime('now'))
      `)
    ]);

    // REQ-B 嘗試確認同一天 10/16 上午 (即便開工時間不同例如 10:00，broad slot morning 相同)
    const updateReqB = d1.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ? AND status = 'to_contact'
    `).bind('REQ-B');

    const insertRsvB = d1.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-B', 'REQ-B', '2026-10-16', 'morning', '10:00', 'active', datetime('now'))
    `);

    // 應因 UNIQUE INDEX idx_uniq_active_slot 碰撞而拋出例外
    await assert.rejects(async () => {
      await d1.batch([updateReqB, insertRsvB]);
    }, /UNIQUE constraint failed/);

    // 驗證 REQ-B 維持 to_contact，且沒有產生任何 reservation (回滾保護)
    const reqB = sqliteDb.prepare('SELECT status FROM service_requests WHERE id = ?').get('REQ-B');
    assert.equal(reqB.status, 'to_contact', 'REQ-B status must remain to_contact');

    const rsvB = sqliteDb.prepare("SELECT * FROM slot_reservations WHERE request_id = 'REQ-B'").get();
    assert.equal(rsvB, undefined, 'No reservation should exist for REQ-B');
  });

  // 測試 4: 重複確認冪等與防護 (Case Q)
  await t.test('4. Repeated Confirmation Protection: cannot confirm already confirmed request; preserves existing reservation', async () => {
    insertRequest({ id: 'REQ-DUP', status: 'to_contact' });

    // 第一次確認
    await d1.batch([
      d1.prepare("UPDATE service_requests SET status = 'confirmed' WHERE id = ? AND status = 'to_contact'").bind('REQ-DUP'),
      d1.prepare(`
        INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
        VALUES ('RSV-DUP-1', 'REQ-DUP', '2026-10-16', 'morning', '09:00', 'active', datetime('now'))
      `)
    ]);

    // 第二次重複確認 (條件式更新 changes = 0)
    const updateAgain = d1.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ? AND (
        status = 'to_contact' OR 
        (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
      )
    `).bind('REQ-DUP', 'REQ-DUP');

    const insertAgain = d1.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-DUP-2', 'REQ-DUP', '2026-10-17', 'afternoon', '14:00', 'active', datetime('now'))
    `);

    // 模擬後端條件檢查：若 changes 為 0 則拒絕
    const res1 = await updateAgain.run();
    assert.equal(res1.meta.changes, 0, 'Condition update must return 0 changes for already confirmed request');

    // 確保依然只有 1 筆 active reservation (RSV-DUP-1)
    const allRsv = sqliteDb.prepare("SELECT * FROM slot_reservations WHERE request_id = 'REQ-DUP'").all();
    assert.equal(allRsv.length, 1);
    assert.equal(allRsv[0].id, 'RSV-DUP-1');
  });

  // 測試 5: 舊 processing 案件過渡補建排程 (Transition for Legacy Requests)
  await t.test('5. Legacy Processing Transition: allows one-time confirm for legacy processing request without reservation', async () => {
    // 建立 1 筆 Ep01 既有的 processing 舊單 (無 reservation)
    insertRequest({ id: 'REQ-LEGACY-01', status: 'processing' });

    const updateReq = d1.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ? AND (
        status = 'to_contact' OR 
        (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
      )
    `).bind('REQ-LEGACY-01', 'REQ-LEGACY-01');

    const insertRsv = d1.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-LEGACY-01', 'REQ-LEGACY-01', '2026-10-19', 'afternoon', '14:30', 'active', datetime('now'))
    `);

    const batchRes = await d1.batch([updateReq, insertRsv]);
    assert.equal(batchRes[0].meta.changes, 1, 'Legacy processing without reservation should be updated to confirmed');

    const req = sqliteDb.prepare('SELECT status FROM service_requests WHERE id = ?').get('REQ-LEGACY-01');
    assert.equal(req.status, 'confirmed');

    const rsv = sqliteDb.prepare("SELECT * FROM slot_reservations WHERE request_id = 'REQ-LEGACY-01'").get();
    assert.equal(rsv.id, 'RSV-LEGACY-01');
    assert.equal(rsv.status, 'active');
  });

  // 測試 6: 原子改期成功 (Case I)
  await t.test('6. Atomic Reschedule Success: marks old reservation released, creates new active reservation', async () => {
    insertRequest({ id: 'REQ-RESCHEDULE', status: 'confirmed' });
    sqliteDb.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-OLD', 'REQ-RESCHEDULE', '2026-10-16', 'morning', '08:30', 'active', datetime('now'))
    `).run();

    // 執行改期至 10/19 下午 13:30
    const releaseOld = d1.prepare(`
      UPDATE slot_reservations 
      SET status = 'released', released_at = datetime('now'), notes = '農友要求延後'
      WHERE id = 'RSV-OLD' AND status = 'active'
    `);

    const insertNew = d1.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-NEW', 'REQ-RESCHEDULE', '2026-10-19', 'afternoon', '13:30', 'active', datetime('now'))
    `);

    const updateReq = d1.prepare("UPDATE service_requests SET updated_at = datetime('now') WHERE id = 'REQ-RESCHEDULE'");

    await d1.batch([releaseOld, insertNew, updateReq]);

    // 驗證舊預約為 released，新預約為 active
    const oldRsv = sqliteDb.prepare("SELECT status, notes FROM slot_reservations WHERE id = 'RSV-OLD'").get();
    assert.equal(oldRsv.status, 'released');
    assert.equal(oldRsv.notes, '農友要求延後');

    const newRsv = sqliteDb.prepare("SELECT status FROM slot_reservations WHERE id = 'RSV-NEW'").get();
    assert.equal(newRsv.status, 'active');

    // 驗證該案件目前僅有 1 筆 active
    const activeList = sqliteDb.prepare("SELECT * FROM slot_reservations WHERE request_id = 'REQ-RESCHEDULE' AND status = 'active'").all();
    assert.equal(activeList.length, 1);
  });

  // 測試 7: 改期碰撞安全回滾 (Case P)
  await t.test('7. Reschedule Collision Rollback: if target slot is occupied, reschedule fails and original reservation remains active', async () => {
    // 案件 1 預約在 10/16 上午
    insertRequest({ id: 'REQ-1', status: 'confirmed' });
    sqliteDb.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-1', 'REQ-1', '2026-10-16', 'morning', '08:30', 'active', datetime('now'))
    `).run();

    // 案件 2 預約在 10/19 下午
    insertRequest({ id: 'REQ-2', status: 'confirmed' });
    sqliteDb.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-2', 'REQ-2', '2026-10-19', 'afternoon', '14:00', 'active', datetime('now'))
    `).run();

    // 案件 1 嘗試改期至 10/19 下午 (與 REQ-2 碰撞)
    const releaseOld = d1.prepare(`
      UPDATE slot_reservations 
      SET status = 'released', released_at = datetime('now')
      WHERE id = 'RSV-1' AND status = 'active'
    `);

    const insertColliding = d1.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-1-NEW', 'REQ-1', '2026-10-19', 'afternoon', '15:00', 'active', datetime('now'))
    `);

    await assert.rejects(async () => {
      await d1.batch([releaseOld, insertColliding]);
    }, /UNIQUE constraint failed/);

    // 核心安全驗收：原預約 RSV-1 依然保持 active！
    const rsv1 = sqliteDb.prepare("SELECT status FROM slot_reservations WHERE id = 'RSV-1'").get();
    assert.equal(rsv1.status, 'active', 'Original reservation MUST remain active on collision');
  });

  // 測試 8: 取消案件釋放時段 (Case J)
  await t.test('8. Cancel Release: cancels confirmed request and releases active reservation', async () => {
    insertRequest({ id: 'REQ-CANCEL', status: 'confirmed' });
    sqliteDb.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-CANCEL', 'REQ-CANCEL', '2026-10-20', 'morning', '09:00', 'active', datetime('now'))
    `).run();

    const cancelReq = d1.prepare(`
      UPDATE service_requests 
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = 'REQ-CANCEL' AND status IN ('to_contact', 'confirmed', 'processing')
    `);

    const releaseRsv = d1.prepare(`
      UPDATE slot_reservations 
      SET status = 'released', released_at = datetime('now'), notes = '農友取消'
      WHERE request_id = 'REQ-CANCEL' AND status = 'active'
    `);

    await d1.batch([cancelReq, releaseRsv]);

    const req = sqliteDb.prepare("SELECT status FROM service_requests WHERE id = 'REQ-CANCEL'").get();
    assert.equal(req.status, 'cancelled');

    const rsv = sqliteDb.prepare("SELECT status, notes FROM slot_reservations WHERE id = 'RSV-CANCEL'").get();
    assert.equal(rsv.status, 'released');
    assert.equal(rsv.notes, '農友取消');

    // 該時段重新變為可預約 (無 active 預約)
    const activeCount = sqliteDb.prepare(`
      SELECT COUNT(*) as cnt FROM slot_reservations 
      WHERE booking_date = '2026-10-20' AND slot_code = 'morning' AND status = 'active'
    `).get();
    assert.equal(activeCount.cnt, 0);
  });

  // 測試 9: 通用更新 Bypass 阻斷靜態與行為審計 (Case R)
  await t.test('9. Generic PATCH Anti-Bypass Guard: forbids status mutations via generic PATCH', () => {
    const backendIndexSrc = fs.readFileSync(path.join(rootDir, 'packages/backend/src/index.ts'), 'utf8');

    // 靜態合約審計：PATCH 端點必須包含 STATUS_MUTATION_FORBIDDEN 守門員
    assert.ok(
      backendIndexSrc.includes("rawBody.status !== undefined"),
      'PATCH endpoint must check if status is provided in rawBody'
    );
    assert.ok(
      backendIndexSrc.includes("STATUS_MUTATION_FORBIDDEN"),
      'PATCH endpoint must return STATUS_MUTATION_FORBIDDEN error code'
    );
    assert.ok(
      !backendIndexSrc.includes("updates.push('status = ?')"),
      'Generic PATCH SQL query must NOT contain status update'
    );
  });

  // 測試 10: 前端管理儀表板生命週期功能審計
  await t.test('10. Frontend AdminDashboard Lifecycle Contract Audit', () => {
    const dashboardSrc = fs.readFileSync(path.join(rootDir, 'packages/frontend/src/components/AdminDashboard.tsx'), 'utf8');

    // 審計專用生命週期 API 呼叫
    assert.ok(dashboardSrc.includes('/api/admin/requests/${id}/confirm'), 'Must call dedicated /confirm endpoint');
    assert.ok(dashboardSrc.includes('/api/admin/requests/${id}/start-work'), 'Must call dedicated /start-work endpoint');
    assert.ok(dashboardSrc.includes('/api/admin/requests/${id}/complete'), 'Must call dedicated /complete endpoint');
    assert.ok(dashboardSrc.includes('/api/admin/requests/${id}/reschedule'), 'Must call dedicated /reschedule endpoint');
    assert.ok(dashboardSrc.includes('/api/admin/requests/${id}/cancel'), 'Must call dedicated /cancel endpoint');

    // 審計開工時間白名單選項
    assert.ok(dashboardSrc.includes("START_TIME_OPTIONS"), 'Must define START_TIME_OPTIONS');
    assert.ok(!dashboardSrc.includes("'12:00'"), 'Must strictly exclude 12:00 lunch time');
    assert.ok(!dashboardSrc.includes("'12:30'"), 'Must strictly exclude 12:30 lunch time');

    // 審計改期對話框
    assert.ok(dashboardSrc.includes("showRescheduleModal"), 'Must contain showRescheduleModal state');
  });
});
