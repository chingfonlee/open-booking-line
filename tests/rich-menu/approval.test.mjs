import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generatePreview,
  createApproval,
  verifyApproval
} from '../../scripts/rich-menu/approval.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const testDir = path.join(rootDir, 'tests/fixtures/rich-menu-approval');

test('Ep02-3 Preview & Approval Gate Test Suite', async (t) => {
  // Setup temp fixture directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const targetsPath = path.join(testDir, 'targets.json');
  const specPath = path.join(testDir, 'menu-spec.json');
  const previewPath = path.join(testDir, 'preview.png');
  const approvalPath = path.join(testDir, 'approval.json');

  // Create mock targets
  const mockTargets = {
    station: { name: '測試服務站' },
    booking: {
      type: 'uri',
      target: 'https://liff.line.me/2000000000-XXXXXXXX'
    },
    query: {
      type: 'message',
      text: '查詢預約'
    }
  };
  fs.writeFileSync(targetsPath, JSON.stringify(mockTargets, null, 2), 'utf8');

  await t.test('1. should generate preview image, spec and return valid sha256 hashes', async () => {
    const result = await generatePreview({
      targetsPath,
      specPath,
      previewPath
    });

    assert.ok(fs.existsSync(specPath));
    assert.ok(fs.existsSync(previewPath));
    assert.match(result.specHash, /^sha256:[a-f0-9]{64}$/);
    assert.match(result.imageHash, /^sha256:[a-f0-9]{64}$/);
    assert.ok(result.sizeBytes < 1048576);
  });

  await t.test('2. verifyApproval should strictly fail when approval.json is missing', () => {
    if (fs.existsSync(approvalPath)) fs.unlinkSync(approvalPath);

    assert.throws(
      () => verifyApproval({ approvalPath, specPath, previewPath }),
      /APPROVAL_MISSING/
    );
  });

  await t.test('3. createApproval should produce matching hashes and verifyApproval should pass', () => {
    const approval = createApproval({ approvalPath, specPath, previewPath });

    assert.equal(approval.approved, true);
    assert.ok(approval.approvedAt);

    const verified = verifyApproval({ approvalPath, specPath, previewPath });
    assert.equal(verified.valid, true);
    assert.equal(verified.specHash, approval.specHash);
    assert.equal(verified.imageHash, approval.imageHash);
  });

  await t.test('4. verifyApproval should reject if image is tampered with by even 1 byte', () => {
    // Append 1 byte to image
    const origBuffer = fs.readFileSync(previewPath);
    const tampered = Buffer.concat([origBuffer, Buffer.from([0x00])]);
    fs.writeFileSync(previewPath, tampered);

    assert.throws(
      () => verifyApproval({ approvalPath, specPath, previewPath }),
      /APPROVAL_HASH_MISMATCH.*Image hash mismatch/
    );

    // Restore original image
    fs.writeFileSync(previewPath, origBuffer);
    assert.equal(verifyApproval({ approvalPath, specPath, previewPath }).valid, true);
  });

  await t.test('5. verifyApproval should reject if spec is modified after approval', () => {
    const origSpec = fs.readFileSync(specPath, 'utf8');
    const tamperedSpec = origSpec.replace('測試服務站', '竄改服務站');
    fs.writeFileSync(specPath, tamperedSpec);

    assert.throws(
      () => verifyApproval({ approvalPath, specPath, previewPath }),
      /APPROVAL_HASH_MISMATCH.*Spec hash mismatch/
    );

    // Restore original spec
    fs.writeFileSync(specPath, origSpec);
    assert.equal(verifyApproval({ approvalPath, specPath, previewPath }).valid, true);
  });

  // Cleanup fixture directory
  t.after(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
