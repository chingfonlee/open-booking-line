import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('Ep03-1 Domain Migration, State Machine & Invariant Unit Tests', async (t) => {
  let db;

  // 輔助函式：建立一筆 service_requests 測試資料
  const createRequest = ({ id, status = 'to_contact', slot = 'morning', date = '2026-10-15' }) => {
    db.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES (?, '王小明', '0912345678', 'branch_crush', '梨', '3 分', '東勢區', '東坑路', ?, ?, ?, 'U_TEST', datetime('now'), datetime('now'))
    `).run(id, date, slot, status);
  };

  t.beforeEach(() => {
    // 建立記憶體 SQLite 資料庫模擬 D1，啟用外鍵約束
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    // 1. 載入 Ep01 基礎 schema
    const ep01Schema = fs.readFileSync(path.join(rootDir, 'packages/backend/schema.sql'), 'utf8');
    db.exec(ep01Schema);

    // 2. 載入 Ep03 遷移腳本
    const ep03Migration = fs.readFileSync(
      path.join(rootDir, 'packages/backend/migrations/0002_ep03_availability_schema.sql'),
      'utf8'
    );
    db.exec(ep03Migration);
  });

  t.afterEach(() => {
    if (db) db.close();
  });

  await t.test('1. Baseline: should apply migration and initialize default configurations cleanly', () => {
    const config = db.prepare('SELECT value FROM availability_config WHERE key = ?').get('mode');
    assert.equal(config.value, 'legacy');

    const rulesCount = db.prepare('SELECT COUNT(*) as count FROM availability_rules').get();
    assert.equal(rulesCount.count, 14); // 7 days * 2 slots
  });

  await t.test('2. Foreign Key: should reject reservation referencing non-existent service_request', () => {
    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    // REQ-GHOST 不存在於 service_requests，外鍵約束必須阻斷
    assert.throws(
      () => {
        db.prepare(insertSql).run('RSV-001', 'REQ-GHOST', '2026-10-15', 'morning', '09:30');
      },
      /FOREIGN KEY constraint failed/
    );

    // 建立合法案件後插入成功
    createRequest({ id: 'REQ-VALID' });
    assert.doesNotThrow(() => {
      db.prepare(insertSql).run('RSV-001', 'REQ-VALID', '2026-10-15', 'morning', '09:30');
    });
  });

  await t.test('3. Whitelist & Lunch Break: should strictly reject lunch times (12:00/12:30) and mismatch slot times', () => {
    createRequest({ id: 'REQ-001' });
    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    // 合法開工時間
    assert.doesNotThrow(() => {
      db.prepare(insertSql).run('RSV-001', 'REQ-001', '2026-10-15', 'morning', '08:00');
    });

    createRequest({ id: 'REQ-002' });
    // 嚴格禁止午休時間 (12:00)
    assert.throws(
      () => {
        db.prepare(insertSql).run('RSV-002', 'REQ-002', '2026-10-16', 'morning', '12:00');
      },
      /CHECK constraint failed/
    );

    createRequest({ id: 'REQ-003' });
    // 嚴格禁止午休時間 (12:30)
    assert.throws(
      () => {
        db.prepare(insertSql).run('RSV-003', 'REQ-003', '2026-10-16', 'afternoon', '12:30');
      },
      /CHECK constraint failed/
    );

    createRequest({ id: 'REQ-004' });
    // 上午時段填寫下午開工時間 (14:00) 必須拒絕
    assert.throws(
      () => {
        db.prepare(insertSql).run('RSV-004', 'REQ-004', '2026-10-17', 'morning', '14:00');
      },
      /CHECK constraint failed/
    );
  });

  await t.test('4. SSOT & Synchronization: unblocking blocked_dates via trigger removes exceptions cleanly without ghost blockades', () => {
    // 模擬 Ep01 舊 API 新增封鎖日期
    db.prepare("INSERT INTO blocked_dates (date, reason, created_at) VALUES ('2026-10-25', '颱風公休', datetime('now'))").run();

    // 驗證觸發器已自動同步至 availability_exceptions
    const exception = db.prepare("SELECT * FROM availability_exceptions WHERE exception_date = '2026-10-25'").get();
    assert.ok(exception, 'Exception should exist after insert');
    assert.equal(exception.slot_code, 'all');

    // 模擬 Ep01 舊 API 解除封鎖 (DELETE FROM blocked_dates)
    db.prepare("DELETE FROM blocked_dates WHERE date = '2026-10-25'").run();

    // 驗證觸發器自動同步刪除，徹底杜絕幽靈封鎖
    const exceptionAfterDelete = db.prepare("SELECT * FROM availability_exceptions WHERE exception_date = '2026-10-25'").get();
    assert.equal(exceptionAfterDelete, undefined, 'Exception must be deleted after unblocking in blocked_dates');
  });

  await t.test('5. Invariant A: should reject two active reservations on the same date and slot', () => {
    createRequest({ id: 'REQ-001' });
    createRequest({ id: 'REQ-002' });

    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    // 第一筆成功
    db.prepare(insertSql).run('RSV-001', 'REQ-001', '2026-10-15', 'morning', '09:30');

    // 第二筆碰撞必須被阻斷
    assert.throws(
      () => {
        db.prepare(insertSql).run('RSV-002', 'REQ-002', '2026-10-15', 'morning', '10:00');
      },
      /UNIQUE constraint failed/
    );
  });

  await t.test('6. Invariant B: should reject two active reservations for the same request', () => {
    createRequest({ id: 'REQ-001' });

    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    db.prepare(insertSql).run('RSV-001', 'REQ-001', '2026-10-15', 'morning', '09:30');

    // 同一 request 再次預約其他時段必須被阻斷
    assert.throws(
      () => {
        db.prepare(insertSql).run('RSV-003', 'REQ-001', '2026-10-16', 'afternoon', '14:00');
      },
      /UNIQUE constraint failed/
    );
  });

  await t.test('7. Conditional Confirm & Anti-Orphan: duplicate confirm fails with 0 changes and 0 orphan reservations', () => {
    createRequest({ id: 'REQ-001', status: 'to_contact' });

    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    // 模擬排程確認交易 (D1 Batch)
    const executeConfirmBatch = (reqId, rsvId, date, slot, time) => {
      db.exec('BEGIN TRANSACTION');
      try {
        const updateResult = db.prepare(`
          UPDATE service_requests 
          SET status = 'confirmed', updated_at = datetime('now')
          WHERE id = ? AND (
            status = 'to_contact' OR 
            (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
          )
        `).run(reqId, reqId);

        if (updateResult.changes === 0) {
          throw new Error('CONDITION_FAILED: Request is not in confirmable state');
        }

        db.prepare(insertSql).run(rsvId, reqId, date, slot, time);
        db.exec('COMMIT');
        return true;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    };

    // 第一次確認：成功
    const success = executeConfirmBatch('REQ-001', 'RSV-001', '2026-10-15', 'morning', '09:30');
    assert.equal(success, true);

    // 第二次重複確認：條件更新 0 筆，引發交易回滾，保證 0 筆孤兒預約
    assert.throws(
      () => {
        executeConfirmBatch('REQ-001', 'RSV-002', '2026-10-15', 'morning', '09:30');
      },
      /CONDITION_FAILED/
    );

    // 驗證目前僅有原本的 1 筆預約，無多餘 reservation
    const rsvList = db.prepare('SELECT * FROM slot_reservations WHERE request_id = ?').all('REQ-001');
    assert.equal(rsvList.length, 1);
    assert.equal(rsvList[0].id, 'RSV-001');
  });

  await t.test('8. Legacy Processing Transition: allows one-time confirm for legacy processing request without reservation', () => {
    // 建立一筆無排程的 Ep01 舊 processing 案件 (如盤點中發現的 5 筆)
    createRequest({ id: 'REQ-LEGACY', status: 'processing' });

    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    // 執行補建排程確認
    db.exec('BEGIN TRANSACTION');
    const updateResult = db.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ? AND (
        status = 'to_contact' OR 
        (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
      )
    `).run('REQ-LEGACY', 'REQ-LEGACY');

    assert.equal(updateResult.changes, 1, 'Legacy processing without reservation should be updated');
    db.prepare(insertSql).run('RSV-LEGACY', 'REQ-LEGACY', '2026-10-18', 'afternoon', '14:00');
    db.exec('COMMIT');

    // 驗證補建成功，正式排程已建立
    const rsv = db.prepare('SELECT * FROM slot_reservations WHERE request_id = ?').get('REQ-LEGACY');
    assert.equal(rsv.status, 'active');
    assert.equal(rsv.scheduled_start_time, '14:00');

    // 再次確認則被阻斷
    const secondUpdate = db.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ? AND (
        status = 'to_contact' OR 
        (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = ? AND status = 'active'))
      )
    `).run('REQ-LEGACY', 'REQ-LEGACY');
    assert.equal(secondUpdate.changes, 0, 'Cannot confirm again once active reservation exists');
  });

  await t.test('9. Atomic Reschedule: collision rolls back entire transaction, preserving original reservation and request', () => {
    createRequest({ id: 'REQ-001', status: 'confirmed' });
    createRequest({ id: 'REQ-002', status: 'confirmed' });

    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    // REQ-001 原排程在 10/15 上午
    db.prepare(insertSql).run('RSV-001', 'REQ-001', '2026-10-15', 'morning', '09:30');
    // REQ-002 已占用 10/16 下午
    db.prepare(insertSql).run('RSV-002', 'REQ-002', '2026-10-16', 'afternoon', '14:00');

    // REQ-001 嘗試改期至 10/16 下午（發生碰撞）
    let caughtError = null;
    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare("UPDATE slot_reservations SET status = 'released', released_at = datetime('now') WHERE id = ?").run('RSV-001');
      db.prepare(insertSql).run('RSV-003', 'REQ-001', '2026-10-16', 'afternoon', '15:00');
      db.prepare("UPDATE service_requests SET updated_at = datetime('now') WHERE id = ?").run('REQ-001');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      caughtError = e;
    }

    assert.ok(caughtError !== null, 'Should have thrown UNIQUE collision error');
    assert.match(caughtError.message, /UNIQUE constraint failed/);

    // 驗證原預約依然為 active，時段不丟失
    const originalRes = db.prepare('SELECT * FROM slot_reservations WHERE id = ?').get('RSV-001');
    assert.equal(originalRes.status, 'active');
    assert.equal(originalRes.booking_date, '2026-10-15');

    // 驗證目標預約未受破壞
    const targetRes = db.prepare('SELECT * FROM slot_reservations WHERE id = ?').get('RSV-002');
    assert.equal(targetRes.status, 'active');
  });

  await t.test('10. Early Cancellation: releases reservation and frees future slot', () => {
    createRequest({ id: 'REQ-001', status: 'confirmed' });
    createRequest({ id: 'REQ-002', status: 'to_contact' });

    const insertSql = `
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
    `;

    db.prepare(insertSql).run('RSV-001', 'REQ-001', '2026-10-20', 'morning', '09:00');

    // 案件提前取消 (D1 Batch: 更新案件狀態為 cancelled + 釋放 reservation)
    db.exec('BEGIN TRANSACTION');
    db.prepare("UPDATE service_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run('REQ-001');
    db.prepare("UPDATE slot_reservations SET status = 'released', released_at = datetime('now') WHERE request_id = ? AND status = 'active'").run('REQ-001');
    db.exec('COMMIT');

    // 驗證無 active 預約
    const active = db.prepare("SELECT * FROM slot_reservations WHERE request_id = ? AND status = 'active'").get('REQ-001');
    assert.equal(active, undefined);

    // 其他案件可立即成功預約該時段
    assert.doesNotThrow(() => {
      db.prepare(insertSql).run('RSV-002', 'REQ-002', '2026-10-20', 'morning', '10:00');
    });
  });

  await t.test('11. Recovery verification: dropping Ep03 tables and triggers restores clean Ep01 baseline', () => {
    const rollbackSql = fs.readFileSync(
      path.join(rootDir, 'packages/backend/scripts/recovery/0002_rollback_ep03.sql'),
      'utf8'
    );
    db.exec(rollbackSql);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);

    assert.ok(tableNames.includes('service_requests'));
    assert.ok(tableNames.includes('blocked_dates'));
    assert.equal(tableNames.includes('slot_reservations'), false);
    assert.equal(tableNames.includes('availability_rules'), false);
    assert.equal(tableNames.includes('availability_config'), false);
    assert.equal(tableNames.includes('availability_exceptions'), false);
  });
});
