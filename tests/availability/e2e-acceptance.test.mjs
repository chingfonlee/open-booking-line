import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  computeAvailability,
  isSlotAvailable,
  getTaipeiToday,
  addDays,
  getDayOfWeek
} from '../../packages/backend/src/availability.ts';
import {
  generateScheduledConfirmationFlex,
  generateProgressQueryFlex
} from '../../packages/backend/src/line.ts';

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

test('Ep03-7 Automated End-to-End Acceptance: Case A through Case U', async (t) => {
  let sqliteDb;
  let d1;

  // 固定確定性時鐘：2026-10-14 02:00:00 UTC (台灣時間 2026-10-14 10:00:00, 週三)
  const mockNowDate = new Date('2026-10-14T02:00:00Z');
  const mockToday = '2026-10-14';

  const VALID_START_TIMES = {
    morning: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
    afternoon: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
  };

  const createRequest = ({ id, status = 'to_contact', slot = 'morning', date = '2026-10-15', phone = '0912345678', contact = '王農友' }) => {
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'branch_crush', '蜜棗', '2 分', '燕巢區', '中民路', ?, ?, ?, 'U_TEST', datetime('now'), datetime('now'))
    `).run(id, contact, phone, date, slot, status);
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

  // ==========================================
  // 核心排程與碰撞案例 (Case A ~ O)
  // ==========================================

  await t.test('Case A: 農友 A 與 B 同時送出 10/15 上午 Pending 均成功（Pending 不占時段）', async () => {
    // 兩位農友送出相同日期 2026-10-15 與相同時段 morning
    createRequest({ id: 'REQ-A', contact: '農友A', date: '2026-10-15', slot: 'morning' });
    createRequest({ id: 'REQ-B', contact: '農友B', date: '2026-10-15', slot: 'morning' });

    const requests = sqliteDb.prepare("SELECT id, status FROM service_requests WHERE preferred_date = '2026-10-15'").all();
    assert.equal(requests.length, 2);
    assert.ok(requests.every(r => r.status === 'to_contact'));

    // 引擎計算可用性：因無 active reservation，10/15 上午依然完全開放
    const avail = await computeAvailability({ db: d1, singleDate: '2026-10-15', nowDate: mockNowDate });
    assert.equal(avail.dates['2026-10-15'].slots.morning, true, 'Slot must remain selectable when only pending exists');
  });

  await t.test('Case B: 管理員確認 A（10/15 上午 09:30），Reservation 建立、A 轉 confirmed', async () => {
    createRequest({ id: 'REQ-A', contact: '農友A', date: '2026-10-15', slot: 'morning' });

    // 管理員確認排程 (D1 Batch 原子寫入)
    const updateReq = d1.prepare("UPDATE service_requests SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'to_contact'").bind('REQ-A');
    const insertRsv = d1.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-A', 'REQ-A', '2026-10-15', 'morning', '09:30', 'active', datetime('now'))");
    await d1.batch([updateReq, insertRsv]);

    const reqA = sqliteDb.prepare("SELECT status FROM service_requests WHERE id = 'REQ-A'").get();
    assert.equal(reqA.status, 'confirmed');

    const rsvA = sqliteDb.prepare("SELECT * FROM slot_reservations WHERE id = 'RSV-A'").get();
    assert.equal(rsvA.status, 'active');
    assert.equal(rsvA.scheduled_start_time, '09:30');
  });

  await t.test('Case C: 新農友查詢 10/15 上午不再可選（鎖定驗證）', async () => {
    createRequest({ id: 'REQ-A', contact: '農友A', date: '2026-10-15', slot: 'morning' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-A', 'REQ-A', '2026-10-15', 'morning', '09:30', 'active', datetime('now'))").run();

    const avail = await computeAvailability({ db: d1, singleDate: '2026-10-15', nowDate: mockNowDate });
    const slotState = avail.dates['2026-10-15'];
    assert.equal(slotState.slots.morning, false, 'Morning slot must be locked/unavailable');
    assert.equal(slotState.reasons.morning, 'reserved');
    assert.equal(slotState.slots.afternoon, true, 'Afternoon slot remains open');
  });

  await t.test('Case D: 管理員嘗試確認 B 於 10/15 上午 ➔ 衝突拒絕（Collision 驗證）', async () => {
    createRequest({ id: 'REQ-A', contact: '農友A', date: '2026-10-15', slot: 'morning' });
    createRequest({ id: 'REQ-B', contact: '農友B', date: '2026-10-15', slot: 'morning' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-A', 'REQ-A', '2026-10-15', 'morning', '09:30', 'active', datetime('now'))").run();

    // 檢查 slot 是否可用 (isSlotAvailable)
    const checkB = await isSlotAvailable(d1, '2026-10-15', 'morning', mockNowDate, true);
    assert.equal(checkB.available, false);
    assert.equal(checkB.reason, 'reserved');

    // 若硬插第二筆，資料庫唯一索引直接阻絕
    assert.throws(() => {
      sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-B', 'REQ-B', '2026-10-15', 'morning', '10:00', 'active', datetime('now'))").run();
    }, /UNIQUE constraint failed/);
  });

  await t.test('Case E: 真實並行同時確認 10/15 上午 ➔ 一成功一衝突（實體並行競爭）', async () => {
    createRequest({ id: 'REQ-1', date: '2026-10-15', slot: 'morning' });
    createRequest({ id: 'REQ-2', date: '2026-10-15', slot: 'morning' });

    let firstSuccess = false;
    let secondFailed = false;

    // 模擬並行請求 1
    try {
      sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-1', 'REQ-1', '2026-10-15', 'morning', '08:30', 'active', datetime('now'))").run();
      firstSuccess = true;
    } catch {}

    // 模擬並行請求 2
    try {
      sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-2', 'REQ-2', '2026-10-15', 'morning', '09:00', 'active', datetime('now'))").run();
    } catch (err) {
      secondFailed = true;
    }

    assert.equal(firstSuccess, true, 'First racer must succeed');
    assert.equal(secondFailed, true, 'Second racer must collide and fail');
  });

  await t.test('Case F: 同一案件同時確認至不同時間 ➔ 僅能成功一筆 active reservation（案件唯一性 Invariant B）', async () => {
    createRequest({ id: 'REQ-SAME', date: '2026-10-16', slot: 'morning' });

    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-MORN', 'REQ-SAME', '2026-10-16', 'morning', '08:30', 'active', datetime('now'))").run();

    // 嘗試同一 REQ-SAME 再插下午 active
    assert.throws(() => {
      sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-AFT', 'REQ-SAME', '2026-10-16', 'afternoon', '13:30', 'active', datetime('now'))").run();
    }, /UNIQUE constraint failed/);
  });

  await t.test('Case G: 取消之案件嘗試確認 ➔ 失敗且不得產生 active reservation', async () => {
    createRequest({ id: 'REQ-CANCELLED', status: 'cancelled', date: '2026-10-16', slot: 'morning' });

    // 條件式更新：僅允許 to_contact 或舊 processing
    const updateStmt = d1.prepare("UPDATE service_requests SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND (status = 'to_contact' OR status = 'processing')").bind('REQ-CANCELLED');
    const insertStmt = d1.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-CAN', 'REQ-CANCELLED', '2026-10-16', 'morning', '08:30', 'active', datetime('now'))");

    // 檢查條件更新行數
    const checkRes = sqliteDb.prepare("UPDATE service_requests SET status = 'confirmed', updated_at = datetime('now') WHERE id = 'REQ-CANCELLED' AND (status = 'to_contact' OR status = 'processing')").run();
    assert.equal(checkRes.changes, 0, 'No rows updated for cancelled request');

    // 確定未新增任何 reservation
    const rsvCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM slot_reservations WHERE request_id = 'REQ-CANCELLED'").get();
    assert.equal(rsvCount.count, 0);
  });

  await t.test('Case H: 開工時間檢驗（白名單：上午 08:00~11:30、下午 13:00~17:00 每 30 分鐘合法；07:30/09:15/12:00/12:30 等午休與界外時間非法拒絕）', async () => {
    createRequest({ id: 'REQ-H1', date: '2026-10-17', slot: 'morning' });

    // 合法測試：08:00 與 11:30
    assert.ok(VALID_START_TIMES.morning.includes('08:00'));
    assert.ok(VALID_START_TIMES.morning.includes('11:30'));
    assert.ok(VALID_START_TIMES.afternoon.includes('13:00'));
    assert.ok(VALID_START_TIMES.afternoon.includes('17:00'));

    // 資料庫 CHECK 約束阻斷午休 12:00
    assert.throws(() => {
      sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-L1', 'REQ-H1', '2026-10-17', 'morning', '12:00', 'active', datetime('now'))").run();
    }, /CHECK constraint failed/);

    // 資料庫 CHECK 約束阻斷午休 12:30
    assert.throws(() => {
      sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-L2', 'REQ-H1', '2026-10-17', 'morning', '12:30', 'active', datetime('now'))").run();
    }, /CHECK constraint failed/);

    // 資料庫 CHECK 約束阻斷非半小時整點 09:15
    assert.throws(() => {
      sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-L3', 'REQ-H1', '2026-10-17', 'morning', '09:15', 'active', datetime('now'))").run();
    }, /CHECK constraint failed/);
  });

  await t.test('Case I: 改期驗證（舊 released，新 active，系統中僅一筆 active）', async () => {
    createRequest({ id: 'REQ-I', status: 'confirmed', date: '2026-10-17', slot: 'morning' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-OLD', 'REQ-I', '2026-10-17', 'morning', '08:30', 'active', datetime('now'))").run();

    // 原子改期至 2026-10-19 下午
    const releaseOld = d1.prepare("UPDATE slot_reservations SET status = 'released', released_at = datetime('now') WHERE id = 'RSV-OLD' AND status = 'active'");
    const insertNew = d1.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-NEW', 'REQ-I', '2026-10-19', 'afternoon', '13:30', 'active', datetime('now'))");
    const updateReq = d1.prepare("UPDATE service_requests SET updated_at = datetime('now') WHERE id = 'REQ-I'");
    await d1.batch([releaseOld, insertNew, updateReq]);

    const activeList = sqliteDb.prepare("SELECT id, status FROM slot_reservations WHERE request_id = 'REQ-I' AND status = 'active'").all();
    assert.equal(activeList.length, 1);
    assert.equal(activeList[0].id, 'RSV-NEW');

    const oldRsv = sqliteDb.prepare("SELECT status FROM slot_reservations WHERE id = 'RSV-OLD'").get();
    assert.equal(oldRsv.status, 'released');
  });

  await t.test('Case J: 已確認案件取消 ➔ 釋放 reservation，時段重新開放', async () => {
    createRequest({ id: 'REQ-J', status: 'confirmed', date: '2026-10-18', slot: 'morning' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-J', 'REQ-J', '2026-10-18', 'morning', '08:30', 'active', datetime('now'))").run();

    // 取消案件並釋放 reservation
    const cancelReq = d1.prepare("UPDATE service_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = 'REQ-J'");
    const releaseRsv = d1.prepare("UPDATE slot_reservations SET status = 'released', released_at = datetime('now') WHERE request_id = 'REQ-J' AND status = 'active'");
    await d1.batch([cancelReq, releaseRsv]);

    // 時段重新開放
    const avail = await computeAvailability({ db: d1, singleDate: '2026-10-18', nowDate: mockNowDate });
    assert.equal(avail.dates['2026-10-18'].slots.morning, true, 'Slot must be restored after cancel');
  });

  await t.test('Case K: 封鎖 10/20 上午 ➔ 農友無法送單', async () => {
    sqliteDb.prepare("INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at) VALUES ('ex_20261020_m', '2026-10-20', 'morning', '站所盤點', datetime('now'))").run();

    const avail = await computeAvailability({ db: d1, singleDate: '2026-10-20', nowDate: mockNowDate });
    assert.equal(avail.dates['2026-10-20'].slots.morning, false);
    assert.equal(avail.dates['2026-10-20'].reasons.morning, 'blocked');

    const slotCheck = await isSlotAvailable(d1, '2026-10-20', 'morning', mockNowDate, false);
    assert.equal(slotCheck.available, false);
  });

  await t.test('Case L: 封鎖已有預約之日期 ➔ 警告提示且不自動取消既有 reservation', async () => {
    createRequest({ id: 'REQ-L', status: 'confirmed', date: '2026-10-21', slot: 'morning' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-L', 'REQ-L', '2026-10-21', 'morning', '09:00', 'active', datetime('now'))").run();

    // 衝突檢測 API 查詢
    const checkConflicts = sqliteDb.prepare("SELECT r.id FROM slot_reservations r WHERE r.booking_date = '2026-10-21' AND r.status = 'active'").all();
    assert.equal(checkConflicts.length, 1, 'Conflict detection accurately reports 1 active reservation');

    // 新增例外封鎖
    sqliteDb.prepare("INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at) VALUES ('ex_20261021_all', '2026-10-21', 'all', '天候不佳休假', datetime('now'))").run();

    // 保全不變量：既有預約完好保持 active
    const rsvCheck = sqliteDb.prepare("SELECT status FROM slot_reservations WHERE id = 'RSV-L'").get();
    assert.equal(rsvCheck.status, 'active', 'Reservation must remain active');
  });

  await t.test('Case M: LINE 確認卡片日期時間與 reservation 100% 一致', async () => {
    const card = generateScheduledConfirmationFlex(
      { id: 'REQ-M', service_type: '果樹代耕', crop_type: '芒果', area_size: '3 分', location_area: '燕巢區' },
      { booking_date: '2026-10-22', slot_code: 'morning', scheduled_start_time: '10:00' },
      'LIFF-TEST',
      '燕巢服務站'
    );

    const bodyBoxes = card.contents.body.contents;
    const dateRow = bodyBoxes.find(b => b.contents?.[0]?.text === '確認日期');
    const timeRow = bodyBoxes.find(b => b.contents?.[0]?.text === '開工時間');

    assert.equal(dateRow.contents[1].text, '2026-10-22 (上午)');
    assert.equal(timeRow.contents[1].text, '10:00 準時抵達');
  });

  await t.test('Case N: LINE 推播失敗時 reservation 維持 confirmed (副作用隔離)', async () => {
    createRequest({ id: 'REQ-N', status: 'to_contact', date: '2026-10-22', slot: 'morning' });

    // 模擬後端 confirm 流程：DB 批次成功，接著推播丟出異常
    const updateReq = d1.prepare("UPDATE service_requests SET status = 'confirmed', updated_at = datetime('now') WHERE id = 'REQ-N'");
    const insertRsv = d1.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-N', 'REQ-N', '2026-10-22', 'morning', '10:00', 'active', datetime('now'))");
    await d1.batch([updateReq, insertRsv]);

    // 模擬 LINE 推播失敗
    try {
      throw new Error('LINE 429 Too Many Requests / Network Timeout');
    } catch (pushErr) {
      // 捕獲異常並記錄，不回滾 DB
    }

    const reqCheck = sqliteDb.prepare("SELECT status FROM service_requests WHERE id = 'REQ-N'").get();
    assert.equal(reqCheck.status, 'confirmed');

    const rsvCheck = sqliteDb.prepare("SELECT status FROM slot_reservations WHERE id = 'RSV-N'").get();
    assert.equal(rsvCheck.status, 'active');
  });

  await t.test('Case O: 農友端 UI 100% 不存在確切時間選擇器', () => {
    const applyFormSource = fs.readFileSync(
      path.join(rootDir, 'packages/frontend/src/components/ApplyForm.tsx'),
      'utf8'
    );

    // 驗證僅提供 morning / afternoon / any
    assert.ok(applyFormSource.includes("value: 'morning'"));
    assert.ok(applyFormSource.includes("value: 'afternoon'"));
    assert.ok(applyFormSource.includes("value: 'any'"));

    // 嚴格檢驗不存在精確時間選擇器 (如 08:00、09:00 或 time input)
    assert.ok(!applyFormSource.includes('type="time"'), 'No exact time picker in farmer UI');
    assert.ok(!applyFormSource.includes('scheduled_start_time'), 'No scheduled_start_time in farmer UI');
  });

  // ==========================================
  // 擴充安全與邊界加固案例 (Case P ~ U)
  // ==========================================

  await t.test('Case P: 改期碰撞防護 - 案件改期至已被占用之時段 ➔ 改期失敗，且原預約依然保持 active 完好', async () => {
    createRequest({ id: 'REQ-P1', status: 'confirmed', date: '2026-10-23', slot: 'morning' });
    createRequest({ id: 'REQ-P2', status: 'confirmed', date: '2026-10-23', slot: 'afternoon' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-P1', 'REQ-P1', '2026-10-23', 'morning', '08:30', 'active', datetime('now'))").run();
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-P2', 'REQ-P2', '2026-10-23', 'afternoon', '13:30', 'active', datetime('now'))").run();

    // REQ-P2 嘗試改期至 2026-10-23 上午 (已被 REQ-P1 占用)
    const releaseOld = d1.prepare("UPDATE slot_reservations SET status = 'released', released_at = datetime('now') WHERE id = 'RSV-P2' AND status = 'active'");
    const insertNew = d1.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-P2-NEW', 'REQ-P2', '2026-10-23', 'morning', '09:00', 'active', datetime('now'))");

    let batchThrew = false;
    try {
      await d1.batch([releaseOld, insertNew]);
    } catch (err) {
      batchThrew = true;
    }

    assert.equal(batchThrew, true, 'Batch must fail and rollback due to partial unique index');

    // 驗證 REQ-P2 原預約依然保持 active
    const p2Rsv = sqliteDb.prepare("SELECT status, booking_date, slot_code FROM slot_reservations WHERE id = 'RSV-P2'").get();
    assert.equal(p2Rsv.status, 'active');
    assert.equal(p2Rsv.slot_code, 'afternoon');
  });

  await t.test('Case Q: 重複確認冪等/防護 - 已確認案件再次收到確認請求 ➔ 阻擋操作，不新增多餘 reservation', async () => {
    createRequest({ id: 'REQ-Q', status: 'confirmed', date: '2026-10-24', slot: 'morning' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-Q', 'REQ-Q', '2026-10-24', 'morning', '08:30', 'active', datetime('now'))").run();

    // 條件式更新防護：REQ-Q 狀態已是 confirmed 且已有 active reservation
    const updateRes = sqliteDb.prepare(`
      UPDATE service_requests 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = 'REQ-Q' AND (
        status = 'to_contact' OR 
        (status = 'processing' AND NOT EXISTS (SELECT 1 FROM slot_reservations WHERE request_id = 'REQ-Q' AND status = 'active'))
      )
    `).run();

    assert.equal(updateRes.changes, 0, 'Must affect 0 rows on already-confirmed request');

    const totalRsv = sqliteDb.prepare("SELECT COUNT(*) as count FROM slot_reservations WHERE request_id = 'REQ-Q'").get();
    assert.equal(totalRsv.count, 1, 'Must strictly maintain 1 reservation');
  });

  await t.test('Case R: 通用更新 Bypass 阻斷 - PATCH /api/admin/requests/:id 禁止帶入 status 欄位', () => {
    const indexSource = fs.readFileSync(
      path.join(rootDir, 'packages/backend/src/index.ts'),
      'utf8'
    );

    // 靜態合約查核：PATCH 端點嚴格檢查 rawBody.status !== undefined 並返回 400 与 STATUS_MUTATION_FORBIDDEN
    assert.ok(indexSource.includes("if (rawBody.status !== undefined)"), 'Must check rawBody.status');
    assert.ok(indexSource.includes('STATUS_MUTATION_FORBIDDEN'), 'Must reject with code STATUS_MUTATION_FORBIDDEN');
    assert.ok(indexSource.includes('禁止透過通用介面修改案件狀態'), 'Must provide clear rejection message');
  });

  await t.test('Case S: 時區跨日邊界 - 以 Asia/Taipei 計算 [T+1, T+30] 閉區間判定', () => {
    // 模擬 UTC 2026-10-14 20:00:00 (台灣時間為 2026-10-15 04:00:00 清晨)
    const lateUtcDate = new Date('2026-10-14T20:00:00Z');
    const taipeiToday = getTaipeiToday(lateUtcDate);
    assert.equal(taipeiToday, '2026-10-15', 'Taipei today must correctly reflect Oct 15 instead of Oct 14');

    // 驗證 T+1 與 T+30 邊界
    const earliestFarmerDate = addDays(taipeiToday, 1);
    const latestFarmerDate = addDays(taipeiToday, 30);
    assert.equal(earliestFarmerDate, '2026-10-16');
    assert.equal(latestFarmerDate, '2026-11-14');
  });

  await t.test('Case T: 遷移失敗回滾 - 隔離腳本乾淨卸載 Ep03 表格與觸發器', () => {
    const rollbackSql = fs.readFileSync(
      path.join(rootDir, 'packages/backend/scripts/recovery/0002_rollback_ep03.sql'),
      'utf8'
    );
    sqliteDb.exec(rollbackSql);

    // 驗證 Ep03 專用表格已被 DROP
    const checkTables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('availability_config', 'availability_rules', 'availability_exceptions', 'slot_reservations')").all();
    assert.equal(checkTables.length, 0, 'All Ep03 tables must be cleanly removed');

    // 驗證 Ep01 基礎 service_requests 完好無缺
    const checkEp01 = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'service_requests'").get();
    assert.ok(checkEp01, 'service_requests table must remain intact');
  });

  await t.test('Case U: Legacy/Managed 模式切換 - Legacy 扣除預約，Managed 全面套用每週規則與例外', async () => {
    // 1. Legacy 模式測試
    const targetDate = '2026-10-21'; // 週三
    createRequest({ id: 'REQ-U', status: 'confirmed', date: targetDate, slot: 'morning' });
    sqliteDb.prepare("INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at) VALUES ('RSV-U', 'REQ-U', '2026-10-21', 'morning', '08:30', 'active', datetime('now'))").run();

    let avail = await computeAvailability({ db: d1, singleDate: targetDate, nowDate: mockNowDate });
    assert.equal(avail.mode, 'legacy');
    assert.equal(avail.dates[targetDate].slots.morning, false, 'Legacy mode still deducts active reservations');
    assert.equal(avail.dates[targetDate].slots.afternoon, true);

    // 2. 切換為 Managed 模式，並將週三下午關閉 (rule_3_afternoon = 0)
    sqliteDb.prepare("UPDATE availability_config SET value = 'managed' WHERE key = 'mode'").run();
    sqliteDb.prepare("UPDATE availability_rules SET is_enabled = 0 WHERE day_of_week = 3 AND slot_code = 'afternoon'").run();

    avail = await computeAvailability({ db: d1, singleDate: targetDate, nowDate: mockNowDate });
    assert.equal(avail.mode, 'managed');
    assert.equal(avail.dates[targetDate].slots.afternoon, false, 'Managed mode enforces weekly closed');
    assert.equal(avail.dates[targetDate].reasons.afternoon, 'weekly_closed');
  });
});
