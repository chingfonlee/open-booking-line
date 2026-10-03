import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  parseD1ListJson,
  checkLiffIdConsistency,
  updateWranglerTomlDatabase
} = require('../../scripts/setup-db.js');

test('Setup DB Helper & Pre-flight Test Suite', async (t) => {
  await t.test('parseD1ListJson should parse pure JSON array', () => {
    const raw = JSON.stringify([
      { uuid: 'uuid-1', name: 'xingnong-db' },
      { uuid: 'uuid-2', name: 'plumber-db' }
    ]);
    const parsed = parseD1ListJson(raw);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].name, 'xingnong-db');
    assert.equal(parsed[1].uuid, 'uuid-2');
  });

  await t.test('parseD1ListJson should parse JSON array embedded in ASCII output', () => {
    const rawWithDecorations = `
⛅️ wrangler 4.139.0
───────────────────
[
  { "uuid": "9ab7d6d6-6e29-421b-8674-6e6bf0d3e770", "name": "xingnong-db" }
]
    `;
    const parsed = parseD1ListJson(rawWithDecorations);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'xingnong-db');
    assert.equal(parsed[0].uuid, '9ab7d6d6-6e29-421b-8674-6e6bf0d3e770');
  });

  await t.test('parseD1ListJson should safely handle empty or malformed string', () => {
    assert.deepEqual(parseD1ListJson(''), []);
    assert.deepEqual(parseD1ListJson('Error: unauthorized'), []);
    assert.deepEqual(parseD1ListJson(null), []);
  });

  await t.test('checkLiffIdConsistency should pass when LIFF prefix matches Channel ID', () => {
    const result = checkLiffIdConsistency('2011709076-09FdfkjH', '2011709076');
    assert.equal(result.valid, true);
    assert.equal(result.prefix, '2011709076');
  });

  await t.test('checkLiffIdConsistency should fail-closed when LIFF prefix mismatches Channel ID', () => {
    // 模擬使用者實際踩到的 431 vs 419 致命錯位
    const result = checkLiffIdConsistency('2011811431-L5tnoolW', '2011811419');
    assert.equal(result.valid, false);
    assert.equal(result.liffPrefix, '2011811431');
    assert.equal(result.channelId, '2011811419');
    assert.ok(result.error.includes('不相符'));
  });

  await t.test('updateWranglerTomlDatabase should replace database_name and database_id precisely', () => {
    const initialToml = `name = "open-booking-line-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "your-d1-database-name"
database_id = "your-d1-database-id"

[vars]
STATION_NAME = "示範預約服務站"
ADMIN_NOTIFY_USER_ID = "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
LINE_LOGIN_CHANNEL_ID = "2000000000"
LIFF_ID = "2000000000-XXXXXXXX"
`;

    const updated = updateWranglerTomlDatabase(initialToml, 'plumber-db', '99999999-aaaa-bbbb-cccc-dddddddddddd');

    assert.ok(updated.includes('database_name = "plumber-db"'), 'database_name must be updated');
    assert.ok(updated.includes('database_id = "99999999-aaaa-bbbb-cccc-dddddddddddd"'), 'database_id must be updated');
    assert.ok(!updated.includes('your-d1-database-name'), 'placeholder must be removed');
    assert.ok(!updated.includes('your-d1-database-id'), 'placeholder must be removed');
    assert.ok(updated.includes('STATION_NAME = "示範預約服務站"'), 'other vars must be preserved');
    assert.ok(updated.includes('LIFF_ID = "2000000000-XXXXXXXX"'), 'LIFF_ID must be preserved');
  });
});
