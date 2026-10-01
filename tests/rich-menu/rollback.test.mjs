import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runRollback } from '../../scripts/rich-menu/rollback.mjs';

const rootDir = path.resolve();
const fixtureDir = path.join(rootDir, 'tests/fixtures/rollback-test');

test('Ep02-4 Safe Rollback Test Suite', async (t) => {
  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }

  const managedPath = path.join(fixtureDir, 'managed.json');

  await t.test('1. Scenario A: should restore previous API default when previousMenuId existed', async () => {
    // Mock initial managed state with previous menu
    fs.writeFileSync(managedPath, JSON.stringify({
      status: 'active',
      currentMenuId: 'richmenu-new-456',
      previousMenuId: 'richmenu-old-123'
    }, null, 2));

    const apiCalls = [];
    const mockFetch = async (endpoint, token, options = {}) => {
      apiCalls.push({ endpoint, method: options.method || 'GET' });
      return { ok: true, status: 200, json: async () => ({ richMenuId: 'richmenu-old-123' }) };
    };

    const res = await runRollback({
      token: 'test-token',
      managedPath,
      customFetch: mockFetch
    });

    assert.equal(res.success, true);
    assert.match(res.rollbackAction, /Restored previous API default/);

    // Verify calls: 1. set default to old, 2. delete new menu, 3. get default to verify
    assert.ok(apiCalls.some(c => c.endpoint === '/user/all/richmenu/richmenu-old-123' && c.method === 'POST'));
    assert.ok(apiCalls.some(c => c.endpoint === '/richmenu/richmenu-new-456' && c.method === 'DELETE'));

    // Check managed file updated
    const updatedManaged = JSON.parse(fs.readFileSync(managedPath, 'utf8'));
    assert.equal(updatedManaged.status, 'rolled-back');
  });

  await t.test('2. Scenario B & C: should clear API default when previous was OA Manager or none', async () => {
    // Mock initial managed state with null previous menu
    fs.writeFileSync(managedPath, JSON.stringify({
      status: 'active',
      currentMenuId: 'richmenu-new-789',
      previousMenuId: null
    }, null, 2));

    const apiCalls = [];
    const mockFetch = async (endpoint, token, options = {}) => {
      apiCalls.push({ endpoint, method: options.method || 'GET' });
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const res = await runRollback({
      token: 'test-token',
      managedPath,
      customFetch: mockFetch
    });

    assert.equal(res.success, true);
    assert.match(res.rollbackAction, /Cleared API default/);

    // Verify calls: 1. DELETE default, 2. delete new menu, 3. get default to verify
    assert.ok(apiCalls.some(c => c.endpoint === '/user/all/richmenu' && c.method === 'DELETE'));
    assert.ok(apiCalls.some(c => c.endpoint === '/richmenu/richmenu-new-789' && c.method === 'DELETE'));

    const updatedManaged = JSON.parse(fs.readFileSync(managedPath, 'utf8'));
    assert.equal(updatedManaged.status, 'rolled-back');
  });

  await t.test('3. should strictly fail-closed if remote default verification mismatches', async () => {
    fs.writeFileSync(managedPath, JSON.stringify({
      status: 'active',
      currentMenuId: 'richmenu-new-456',
      previousMenuId: 'richmenu-old-123'
    }, null, 2));

    const mockFetch = async (endpoint, token, options = {}) => {
      if (endpoint === '/user/all/richmenu' && options.method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ richMenuId: 'wrong-menu-id' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await assert.rejects(
      async () => {
        await runRollback({ token: 'test-token', managedPath, customFetch: mockFetch });
      },
      /ROLLBACK_VERIFY_FAILED/
    );
  });

  await t.test('4. should reject repeated rollback to prevent deleting restored active menu', async () => {
    fs.writeFileSync(managedPath, JSON.stringify({
      status: 'rolled-back',
      currentMenuId: null,
      previousMenuId: 'richmenu-old-123'
    }, null, 2));

    await assert.rejects(
      async () => {
        await runRollback({ token: 'test-token', managedPath });
      },
      /ALREADY_ROLLED_BACK/
    );
  });

  t.after(() => {
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
