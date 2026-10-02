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
import { Hono } from '../../packages/backend/node_modules/hono/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// 封裝 node:sqlite 成為 D1Like 物件以利異步引擎呼叫
function createD1Adapter(sqliteDb) {
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      return {
        bind(...params) {
          return {
            async all() {
              const rows = stmt.all(...params);
              return { results: rows };
            },
            async first() {
              const row = stmt.get(...params);
              return row || null;
            }
          };
        },
        async all(...params) {
          const rows = stmt.all(...params);
          return { results: rows };
        },
        async first(...params) {
          const row = stmt.get(...params);
          return row || null;
        }
      };
    }
  };
}

test('Ep03-2 Availability Engine & Read API Comprehensive Tests', async (t) => {
  let sqliteDb;
  let d1;

  // 固定可預測的測試時鐘：2026-10-14 10:00:00 UTC (台灣時間 2026-10-14 18:00:00, 週三)
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

  await t.test('1. Timezone & Calendar Math: verifies Asia/Taipei today and day of week', () => {
    const today = getTaipeiToday(mockNowDate);
    assert.equal(today, '2026-10-14');
    assert.equal(getDayOfWeek('2026-10-14'), 3); // 2026-10-14 is Wednesday (3)
    assert.equal(getDayOfWeek('2026-10-18'), 0); // 2026-10-18 is Sunday (0)
    assert.equal(addDays('2026-10-14', 1), '2026-10-15');
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  });

  await t.test('2. Normal Date in Legacy Mode: defaults to all open within [T+1, T+30]', async () => {
    const res = await computeAvailability({
      db: d1,
      singleDate: '2026-10-15',
      nowDate: mockNowDate
    });

    assert.equal(res.mode, 'legacy');
    const day = res.dates['2026-10-15'];
    assert.ok(day);
    assert.equal(day.selectable, true);
    assert.equal(day.slots.morning, true);
    assert.equal(day.slots.afternoon, true);
    assert.equal(day.slots.any, true);
    assert.equal(day.reasons.morning, null);
    assert.equal(day.reasons.afternoon, null);
  });

  await t.test('3. Whole-day Blocked (Exception all): marks morning, afternoon, and any as false', async () => {
    // 建立 2026-10-20 全天例外封鎖
    sqliteDb.prepare(`
      INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
      VALUES ('EX-1', '2026-10-20', 'all', '農會教育訓練', datetime('now'))
    `).run();

    const res = await computeAvailability({
      db: d1,
      singleDate: '2026-10-20',
      nowDate: mockNowDate
    });

    const day = res.dates['2026-10-20'];
    assert.equal(day.selectable, false);
    assert.equal(day.slots.morning, false);
    assert.equal(day.slots.afternoon, false);
    assert.equal(day.slots.any, false);
    assert.equal(day.reasons.morning, 'blocked');
    assert.equal(day.reasons.afternoon, 'blocked');
  });

  await t.test('4. Morning Blocked (Exception morning): morning is false, afternoon remains true, any is true', async () => {
    // 建立 2026-10-21 上午例外封鎖
    sqliteDb.prepare(`
      INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
      VALUES ('EX-2', '2026-10-21', 'morning', '機具保養', datetime('now'))
    `).run();

    const res = await computeAvailability({
      db: d1,
      singleDate: '2026-10-21',
      nowDate: mockNowDate
    });

    const day = res.dates['2026-10-21'];
    assert.equal(day.selectable, true);
    assert.equal(day.slots.morning, false);
    assert.equal(day.slots.afternoon, true);
    assert.equal(day.slots.any, true); // 因為下午仍可選，故「都可以」仍為 true
    assert.equal(day.reasons.morning, 'blocked');
    assert.equal(day.reasons.afternoon, null);
  });

  await t.test('5. Active Reservation Lock: active reservation on morning locks morning with reason reserved', async () => {
    // 建立 service_request 與 active reservation
    sqliteDb.prepare(`
      INSERT INTO service_requests (
        id, contact_name, phone, service_type, crop_type, area_size,
        location_area, location_address, preferred_date, preferred_time_slot,
        status, line_user_id, created_at, updated_at
      ) VALUES ('REQ-101', '陳農友', '0911222333', 'branch_crush', '蜜棗', '2 分', '燕巢區', '中興路', '2026-10-22', 'morning', 'confirmed', 'U1', datetime('now'), datetime('now'))
    `).run();

    sqliteDb.prepare(`
      INSERT INTO slot_reservations (id, request_id, booking_date, slot_code, scheduled_start_time, status, created_at)
      VALUES ('RSV-101', 'REQ-101', '2026-10-22', 'morning', '09:00', 'active', datetime('now'))
    `).run();

    const res = await computeAvailability({
      db: d1,
      singleDate: '2026-10-22',
      nowDate: mockNowDate
    });

    const day = res.dates['2026-10-22'];
    assert.equal(day.slots.morning, false);
    assert.equal(day.slots.afternoon, true);
    assert.equal(day.slots.any, true);
    assert.equal(day.reasons.morning, 'reserved');
    assert.equal(day.reasons.afternoon, null);
  });

  await t.test('6. Pending Request NEVER reduces availability: multiple pending requests do not lock slots', async () => {
    // 建立 10 筆針對 2026-10-23 上午的 pending 申請
    for (let i = 1; i <= 10; i++) {
      sqliteDb.prepare(`
        INSERT INTO service_requests (
          id, contact_name, phone, service_type, crop_type, area_size,
          location_area, location_address, preferred_date, preferred_time_slot,
          status, line_user_id, created_at, updated_at
        ) VALUES (?, '王農友', '0912000000', 'branch_crush', '芭樂', '1 分', '大社區', '翠屏路', '2026-10-23', 'morning', 'to_contact', 'U2', datetime('now'), datetime('now'))
      `).run(`REQ-PENDING-${i}`);
    }

    const res = await computeAvailability({
      db: d1,
      singleDate: '2026-10-23',
      nowDate: mockNowDate
    });

    const day = res.dates['2026-10-23'];
    // 儘管有 10 筆 Pending 申請，上午時段依然 100% 可選！
    assert.equal(day.slots.morning, true);
    assert.equal(day.slots.afternoon, true);
    assert.equal(day.slots.any, true);
    assert.equal(day.reasons.morning, null);
  });

  await t.test('7. Past and Lead Time dates boundary: rejects past dates and today for farmers, permits today for admin', async () => {
    // 過去日期：2026-10-13 (< 2026-10-14)
    const pastRes = await computeAvailability({
      db: d1,
      singleDate: '2026-10-13',
      nowDate: mockNowDate
    });
    assert.equal(pastRes.dates['2026-10-13'].selectable, false);
    assert.equal(pastRes.dates['2026-10-13'].reasons.morning, 'past');

    // 當天日期：2026-10-14 (農友端前置期 lead_time = 1，不可選)
    const todayRes = await computeAvailability({
      db: d1,
      singleDate: '2026-10-14',
      nowDate: mockNowDate,
      isAdmin: false
    });
    assert.equal(todayRes.dates['2026-10-14'].selectable, false);
    assert.equal(todayRes.dates['2026-10-14'].reasons.morning, 'lead_time');

    // 管理員端查詢當天：允許排定
    const adminTodayRes = await computeAvailability({
      db: d1,
      singleDate: '2026-10-14',
      nowDate: mockNowDate,
      isAdmin: true
    });
    assert.equal(adminTodayRes.dates['2026-10-14'].selectable, true);
    assert.equal(adminTodayRes.dates['2026-10-14'].slots.morning, true);
  });

  await t.test('8. Outside Horizon: dates beyond 30 days are rejected for farmers', async () => {
    const farDate = addDays(mockToday, 31); // T + 31
    const res = await computeAvailability({
      db: d1,
      singleDate: farDate,
      nowDate: mockNowDate,
      isAdmin: false
    });
    assert.equal(res.dates[farDate].selectable, false);
    assert.equal(res.dates[farDate].reasons.morning, 'outside_horizon');
  });

  await t.test('9. Mode Switch: switching to managed mode enforces weekly rules (weekend closed)', async () => {
    const sundayDate = '2026-10-18'; // 週日

    // (A) Legacy 模式下：週日仍開放
    const legacyRes = await computeAvailability({
      db: d1,
      singleDate: sundayDate,
      nowDate: mockNowDate
    });
    assert.equal(legacyRes.mode, 'legacy');
    assert.equal(legacyRes.dates[sundayDate].slots.morning, true);

    // (B) 管理員啟用 Managed 模式
    sqliteDb.prepare("UPDATE availability_config SET value = 'managed' WHERE key = 'mode'").run();

    const managedRes = await computeAvailability({
      db: d1,
      singleDate: sundayDate,
      nowDate: mockNowDate
    });
    assert.equal(managedRes.mode, 'managed');
    assert.equal(managedRes.dates[sundayDate].slots.morning, false);
    assert.equal(managedRes.dates[sundayDate].slots.afternoon, false);
    assert.equal(managedRes.dates[sundayDate].reasons.morning, 'weekly_closed');
    assert.equal(managedRes.dates[sundayDate].reasons.afternoon, 'weekly_closed');
  });

  await t.test('10. isSlotAvailable helper: correctly verifies slot readiness', async () => {
    const available = await isSlotAvailable(d1, '2026-10-15', 'morning', mockNowDate);
    assert.equal(available.available, true);

    // 加上封鎖後
    sqliteDb.prepare(`
      INSERT INTO availability_exceptions (id, exception_date, slot_code, reason, created_at)
      VALUES ('EX-3', '2026-10-15', 'morning', '休息', datetime('now'))
    `).run();

    const blocked = await isSlotAvailable(d1, '2026-10-15', 'morning', mockNowDate);
    assert.equal(blocked.available, false);
    assert.equal(blocked.reason, 'blocked');

    // 但下午仍可選，且 any 仍為 true
    const anyAvail = await isSlotAvailable(d1, '2026-10-15', 'any', mockNowDate);
    assert.equal(anyAvail.available, true);
  });

  await t.test('11. Range and Month Queries: correctly queries multi-day windows', async () => {
    const rangeRes = await computeAvailability({
      db: d1,
      fromDate: '2026-10-15',
      toDate: '2026-10-17',
      nowDate: mockNowDate
    });
    assert.equal(Object.keys(rangeRes.dates).length, 3);
    assert.ok(rangeRes.dates['2026-10-15']);
    assert.ok(rangeRes.dates['2026-10-16']);
    assert.ok(rangeRes.dates['2026-10-17']);
  });

  await t.test('12. HTTP Route GET /api/availability: integrates cleanly with Hono app', async () => {
    const app = new Hono();
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

        const data = await computeAvailability({
          db: d1,
          singleDate,
          fromDate,
          toDate,
          nowDate: mockNowDate
        });

        return c.json({ success: true, data });
      } catch (error) {
        return c.json({ success: false, message: error.message }, 400);
      }
    });

    // 透過 app.request 測試單日查詢 HTTP 端點
    const req = new Request('http://localhost/api/availability?date=2026-10-16');
    const res = await app.request(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.dates['2026-10-16']);
    assert.equal(json.data.dates['2026-10-16'].slots.morning, true);

    // 測試月份查詢 month=2026-10
    const monthReq = new Request('http://localhost/api/availability?month=2026-10');
    const monthRes = await app.request(monthReq);
    assert.equal(monthRes.status, 200);
    const monthJson = await monthRes.json();
    assert.equal(monthJson.success, true);
    assert.ok(monthJson.data.dates['2026-10-01']);
    assert.ok(monthJson.data.dates['2026-10-31']);
  });
});
