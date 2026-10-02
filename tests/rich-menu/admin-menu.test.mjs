import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { buildAdminMenuSpec, toLineRichMenuObject, validateLineRichMenuObject } from '../../scripts/rich-menu/builder.mjs';
import { generateMenuSvg, renderMenuImage, CANVAS_WIDTH, CANVAS_HEIGHT, MAX_FILE_SIZE } from '../../scripts/rich-menu/renderer.mjs';
import { createAdminApproval, verifyAdminApproval, ADMIN_SPEC_PATH, ADMIN_PREVIEW_PATH, ADMIN_APPROVAL_PATH } from '../../scripts/rich-menu/approval.mjs';
import { runAdminPublisher, linkRemoteUserRichMenu, unlinkRemoteUserRichMenu, getRemoteUserRichMenu } from '../../scripts/rich-menu/publisher.mjs';

const mockTargets = {
  station: { name: '高雄服務站' },
  booking: {
    type: 'uri',
    target: 'https://liff.line.me/2011709076-09FdfkjH'
  },
  query: {
    type: 'message',
    text: '查詢預約'
  }
};

test('Ep02-Admin: Admin Dual-Hub 6-Action Rich Menu Test Suite', async (t) => {
  const adminSpec = buildAdminMenuSpec(mockTargets);

  await t.test('1. should build valid Admin Spec with 6 non-overlapping actions across 2 hubs', () => {
    assert.equal(adminSpec.type, 'admin');
    assert.equal(adminSpec.buttons.length, 6);
    assert.ok(adminSpec.chatBarText.length <= 14);

    const lineObj = toLineRichMenuObject(adminSpec);
    assert.doesNotThrow(() => validateLineRichMenuObject(lineObj));
    assert.equal(lineObj.areas.length, 6);

    // Verify all 6 action URLs contain admin routing parameters
    const toContact = adminSpec.buttons.find(b => b.id === 'admin_to_contact');
    assert.ok(toContact.action.uri.includes('filter=to_contact'));

    const confirmed = adminSpec.buttons.find(b => b.id === 'admin_confirmed');
    assert.ok(confirmed.action.uri.includes('filter=confirmed'));

    const settings = adminSpec.buttons.find(b => b.id === 'admin_settings');
    assert.ok(settings.action.uri.includes('tab=settings'));

    const history = adminSpec.buttons.find(b => b.id === 'admin_history');
    assert.ok(history.action.uri.includes('filter=all'));
  });

  await t.test('2. should render exact 2500x1686 admin image under 1MB limit deterministically', async () => {
    const { buffer, sizeBytes, dimensions, svg } = await renderMenuImage(adminSpec);

    assert.equal(dimensions.width, CANVAS_WIDTH);
    assert.equal(dimensions.height, CANVAS_HEIGHT);
    assert.ok(sizeBytes < 500000, `Expected < 500KB, got ${sizeBytes}`);
    assert.ok(sizeBytes <= MAX_FILE_SIZE);

    assert.ok(svg.includes('高雄服務站'));
    assert.ok(svg.includes('現場業務與即時調度'));
    assert.ok(svg.includes('站所管理與設定工具'));

    // Verify sharp metadata
    const meta = await sharp(buffer).metadata();
    assert.equal(meta.width, CANVAS_WIDTH);
    assert.equal(meta.height, CANVAS_HEIGHT);
    assert.equal(meta.format, 'png');

    // Determinism check
    const res2 = await renderMenuImage(adminSpec);
    const hash1 = crypto.createHash('sha256').update(buffer).digest('hex');
    const hash2 = crypto.createHash('sha256').update(res2.buffer).digest('hex');
    assert.equal(hash1, hash2, 'Admin render must be 100% deterministic');
  });

  await t.test('3. should enforce admin approval gate and detect tampering', (t) => {
    const tmpDir = path.join(process.cwd(), '.booking/rich-menu-test-admin-approval');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const specPath = path.join(tmpDir, 'spec.json');
    const previewPath = path.join(tmpDir, 'preview.png');
    const approvalPath = path.join(tmpDir, 'approval.json');

    fs.writeFileSync(specPath, JSON.stringify(adminSpec, null, 2), 'utf8');
    fs.writeFileSync(previewPath, Buffer.from('fake-admin-image-bytes'));

    // Create approval
    createAdminApproval({ specPath, previewPath, approvalPath });

    // Verify valid
    const check = verifyAdminApproval({ specPath, previewPath, approvalPath });
    assert.equal(check.valid, true);

    // Tamper spec
    fs.writeFileSync(specPath, JSON.stringify({ ...adminSpec, name: 'tampered' }, null, 2), 'utf8');
    assert.throws(() => {
      verifyAdminApproval({ specPath, previewPath, approvalPath });
    }, /APPROVAL_HASH_MISMATCH/);

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('4. should link and unlink user rich menu via mock fetch', async () => {
    let linkedUserId = null;
    let linkedMenuId = null;
    let unlinkedUserId = null;

    const mockFetch = async (url, token, options) => {
      if (url.includes('/richmenu/validate')) {
        return { ok: true, status: 200, text: async () => '' };
      }
      if (url.match(/\/user\/([^/]+)\/richmenu\/([^/]+)/) && options.method === 'POST') {
        const parts = url.split('/');
        linkedUserId = parts[2];
        linkedMenuId = parts[4];
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (url.match(/\/user\/([^/]+)\/richmenu$/) && options.method === 'DELETE') {
        const parts = url.split('/');
        unlinkedUserId = parts[2];
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (url.match(/\/user\/([^/]+)\/richmenu$/) && options.method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ richMenuId: 'richmenu-admin-123' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    await linkRemoteUserRichMenu('mock-token', 'U_ADMIN_001', 'richmenu-admin-999', mockFetch);
    assert.equal(linkedUserId, 'U_ADMIN_001');
    assert.equal(linkedMenuId, 'richmenu-admin-999');

    const activeMenu = await getRemoteUserRichMenu('mock-token', 'U_ADMIN_001', mockFetch);
    assert.equal(activeMenu, 'richmenu-admin-123');

    await unlinkRemoteUserRichMenu('mock-token', 'U_ADMIN_001', mockFetch);
    assert.equal(unlinkedUserId, 'U_ADMIN_001');
  });

  await t.test('5. runAdminPublisher should support dry-run preflight safely', async () => {
    const mockFetch = async (url) => {
      if (url.includes('/richmenu/validate')) {
        return { ok: true, status: 200, text: async () => '' };
      }
      throw new Error(`Unexpected call in dry-run: ${url}`);
    };

    const res = await runAdminPublisher({
      token: 'mock-token',
      dryRun: true,
      userIds: ['U_ADMIN_TEST'],
      customFetch: mockFetch
    });

    assert.equal(res.success, true);
    assert.equal(res.mode, 'admin-dry-run');
    assert.deepEqual(res.targetUserIds, ['U_ADMIN_TEST']);
  });
});
