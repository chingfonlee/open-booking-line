import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDiscovery } from '../../scripts/rich-menu/discovery.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('Ep02-0 Discovery Test Suite', async (t) => {
  await t.test('1. should discover booking target, query target and station name with source tracking', async () => {
    const { targets, targetOutPath } = await runDiscovery();

    // Verify booking target
    assert.equal(targets.booking.type, 'uri');
    assert.match(targets.booking.target, /^https:\/\/liff\.line\.me\//);
    assert.ok(targets.booking.source.file);
    assert.ok(typeof targets.booking.source.line === 'number');

    // Verify query action
    assert.equal(targets.query.type, 'message');
    assert.equal(targets.query.text, '查詢預約');
    assert.ok(targets.query.source.file.includes('index.ts'));
    assert.ok(targets.query.source.lines);

    // Verify station name
    assert.equal(targets.station.name, '高雄服務站');
    assert.ok(targets.station.source.file);

    // Verify output file exists
    assert.ok(fs.existsSync(targetOutPath));
    const saved = JSON.parse(fs.readFileSync(targetOutPath, 'utf8'));
    assert.equal(saved.booking.target, targets.booking.target);
  });

  await t.test('2. should not leak any secrets in output JSON', async () => {
    const { targets } = await runDiscovery();
    const str = JSON.stringify(targets);

    assert.ok(!str.includes('Bearer'));
    assert.ok(!str.includes('CHANNEL_SECRET'));
    assert.ok(!str.includes('TURNSTILE_SECRET_KEY'));
  });

  await t.test('3. should handle missing token safely without blocking local discovery', async () => {
    const { targets } = await runDiscovery({ token: null });

    assert.equal(targets.line.status, 'requires-operation-token');
    assert.equal(targets.line.hasExistingDefault, null);
    assert.ok(targets.line.note);
  });

  await t.test('4. targets.json should be inside gitignored directory', async () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');

    assert.ok(gitignore.includes('.booking/rich-menu/'));
  });
});
