import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runPublisher } from '../../scripts/rich-menu/publisher.mjs';
import { generatePreview, createApproval } from '../../scripts/rich-menu/approval.mjs';

const rootDir = path.resolve();
const fixtureDir = path.join(rootDir, 'tests/fixtures/publisher-test');

test('Ep02-4 Safe Publisher Test Suite', async (t) => {
  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }

  const targetsPath = path.join(fixtureDir, 'targets.json');
  const specPath = path.join(fixtureDir, 'menu-spec.json');
  const previewPath = path.join(fixtureDir, 'preview.png');
  const approvalPath = path.join(fixtureDir, 'approval.json');
  const managedPath = path.join(fixtureDir, 'managed.json');

  // Generate valid test approval
  fs.writeFileSync(targetsPath, JSON.stringify({
    station: { name: '測試發布站' },
    booking: { type: 'uri', target: 'https://liff.line.me/2000000000-XXXXXXXX' },
    query: { type: 'message', text: '查詢預約' }
  }, null, 2));

  await generatePreview({ targetsPath, specPath, previewPath });
  createApproval({ approvalPath, specPath, previewPath });

  await t.test('1. dry-run should strictly validate without creating or modifying remote resources', async () => {
    const apiCalls = [];

    const mockFetch = async (endpoint, token, options = {}) => {
      apiCalls.push({ endpoint, method: options.method || 'GET' });

      if (endpoint === '/richmenu/validate') {
        return { ok: true, status: 200, text: async () => '' };
      }
      if (endpoint === '/user/all/richmenu') {
        return { ok: true, status: 200, json: async () => ({ richMenuId: 'old-menu-999' }) };
      }
      throw new Error(`Unexpected endpoint called in dry-run: ${endpoint}`);
    };

    const res = await runPublisher({
      dryRun: true,
      token: 'test-token',
      specPath,
      previewPath,
      approvalPath,
      managedPath,
      customFetch: mockFetch
    });

    assert.equal(res.success, true);
    assert.equal(res.mode, 'dry-run');
    assert.equal(res.previousDefaultMenuId, 'old-menu-999');

    // Confirm only validate and get were called
    assert.equal(apiCalls.length, 2);
    assert.equal(apiCalls[0].endpoint, '/richmenu/validate');
    assert.equal(apiCalls[1].endpoint, '/user/all/richmenu');
  });

  await t.test('2. should fail-closed and reject execution if approval hash does not match', async () => {
    // Tamper with preview image
    const origBuffer = fs.readFileSync(previewPath);
    fs.writeFileSync(previewPath, Buffer.concat([origBuffer, Buffer.from([0xff])]));

    await assert.rejects(
      async () => {
        await runPublisher({
          dryRun: true,
          token: 'test-token',
          specPath,
          previewPath,
          approvalPath,
          managedPath
        });
      },
      /APPROVAL_HASH_MISMATCH/
    );

    // Restore preview image
    fs.writeFileSync(previewPath, origBuffer);
  });

  await t.test('3. full publish pipeline should atomically create, upload, set default, and track in managed.json', async () => {
    const apiCalls = [];

    const mockFetch = async (endpoint, token, options = {}) => {
      apiCalls.push({ endpoint, method: options.method || 'GET' });

      if (endpoint === '/richmenu/validate') {
        return { ok: true, status: 200 };
      }
      if (endpoint === '/user/all/richmenu' && options.method === 'GET') {
        // First check returns old default, second check (verify) returns new default
        const isSecondCheck = apiCalls.filter(c => c.endpoint === '/user/all/richmenu' && c.method === 'GET').length === 2;
        return {
          ok: true,
          status: 200,
          json: async () => ({ richMenuId: isSecondCheck ? 'richmenu-new-123' : 'richmenu-old-000' })
        };
      }
      if (endpoint === '/richmenu' && options.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ richMenuId: 'richmenu-new-123' }) };
      }
      if (endpoint.includes('/content') && options.method === 'POST') {
        return { ok: true, status: 200 };
      }
      if (endpoint === '/user/all/richmenu/richmenu-new-123' && options.method === 'POST') {
        return { ok: true, status: 200 };
      }
      throw new Error(`Unhandled mock endpoint: ${endpoint} ${options.method}`);
    };

    const res = await runPublisher({
      dryRun: false,
      token: 'test-token',
      specPath,
      previewPath,
      approvalPath,
      managedPath,
      customFetch: mockFetch
    });

    assert.equal(res.success, true);
    assert.equal(res.newRichMenuId, 'richmenu-new-123');
    assert.equal(res.previousDefaultMenuId, 'richmenu-old-000');

    // Verify managed.json was created
    assert.ok(fs.existsSync(managedPath));
    const managed = JSON.parse(fs.readFileSync(managedPath, 'utf8'));
    assert.equal(managed.currentMenuId, 'richmenu-new-123');
    assert.equal(managed.previousMenuId, 'richmenu-old-000');
    assert.equal(managed.status, 'active');
  });

  await t.test('4. should recover previous default if error occurs after default was switched', async () => {
    const apiCalls = [];
    const mockFetch = async (endpoint, token, options = {}) => {
      apiCalls.push({ endpoint, method: options.method || 'GET' });
      if (endpoint === '/richmenu/validate') return { ok: true, status: 200 };
      if (endpoint === '/user/all/richmenu' && options.method === 'GET') {
        const isVerify = apiCalls.filter(c => c.endpoint === '/user/all/richmenu' && c.method === 'GET').length > 1;
        if (isVerify) {
          throw new Error('NETWORK_TIMEOUT_DURING_VERIFICATION');
        }
        return { ok: true, status: 200, json: async () => ({ richMenuId: 'old-default-111' }) };
      }
      if (endpoint === '/richmenu' && options.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ richMenuId: 'new-menu-222' }) };
      }
      if (endpoint.includes('/content') && options.method === 'POST') return { ok: true, status: 200 };
      if (endpoint === '/user/all/richmenu/new-menu-222' && options.method === 'POST') return { ok: true, status: 200 };
      if (endpoint === '/user/all/richmenu/old-default-111' && options.method === 'POST') return { ok: true, status: 200 };
      if (endpoint === '/richmenu/new-menu-222' && options.method === 'DELETE') return { ok: true, status: 200 };
      throw new Error(`Unhandled mock endpoint: ${endpoint} ${options.method}`);
    };

    await assert.rejects(
      async () => {
        await runPublisher({
          dryRun: false,
          token: 'test-token',
          specPath,
          previewPath,
          approvalPath,
          managedPath,
          customFetch: mockFetch
        });
      },
      /NETWORK_TIMEOUT_DURING_VERIFICATION/
    );

    // Verify recovery calls: restored old default and deleted failed new menu
    assert.ok(apiCalls.some(c => c.endpoint === '/user/all/richmenu/old-default-111' && c.method === 'POST'));
    assert.ok(apiCalls.some(c => c.endpoint === '/richmenu/new-menu-222' && c.method === 'DELETE'));

    // Check managed state recorded failure
    const managed = JSON.parse(fs.readFileSync(managedPath, 'utf8'));
    assert.equal(managed.status, 'failed');
    assert.equal(managed.defaultRestored, true);
  });

  t.after(() => {
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
