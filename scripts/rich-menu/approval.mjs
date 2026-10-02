import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildMenuSpec, buildAdminMenuSpec } from './builder.mjs';
import { renderMenuImage } from './renderer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export const RICH_MENU_DIR = path.join(rootDir, '.booking/rich-menu');
export const TARGETS_PATH = path.join(RICH_MENU_DIR, 'targets.json');
export const SPEC_PATH = path.join(RICH_MENU_DIR, 'menu-spec.json');
export const PREVIEW_PATH = path.join(RICH_MENU_DIR, 'preview.png');
export const APPROVAL_PATH = path.join(RICH_MENU_DIR, 'approval.json');

export const ADMIN_SPEC_PATH = path.join(RICH_MENU_DIR, 'admin-menu-spec.json');
export const ADMIN_PREVIEW_PATH = path.join(RICH_MENU_DIR, 'admin-preview.png');
export const ADMIN_APPROVAL_PATH = path.join(RICH_MENU_DIR, 'admin-approval.json');

/**
 * Computes sha256 hash formatted as sha256:<hex>
 */
export function computeSha256(data) {
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Generates Menu Spec and Preview Image from targets.json
 */
export async function generatePreview(options = {}) {
  const targetsPath = options.targetsPath || TARGETS_PATH;
  if (!fs.existsSync(targetsPath)) {
    throw new Error(`TARGETS_NOT_FOUND: ${targetsPath} does not exist. Please run Ep02-0 discovery first.`);
  }

  const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
  const spec = buildMenuSpec(targets, options);

  if (!fs.existsSync(RICH_MENU_DIR)) {
    fs.mkdirSync(RICH_MENU_DIR, { recursive: true });
  }

  const specPath = options.specPath || SPEC_PATH;
  const previewPath = options.previewPath || PREVIEW_PATH;

  // Write spec
  const specContent = JSON.stringify(spec, null, 2);
  fs.writeFileSync(specPath, specContent, 'utf8');

  // Render image
  const { buffer, sizeBytes } = await renderMenuImage(spec, { outputPath: previewPath });

  const specHash = computeSha256(specContent);
  const imageHash = computeSha256(buffer);

  return {
    spec,
    specPath,
    previewPath,
    specHash,
    imageHash,
    sizeBytes
  };
}

/**
 * Verifies if approval.json exists and hashes match current spec & image
 */
export function verifyApproval(options = {}) {
  const approvalPath = options.approvalPath || APPROVAL_PATH;
  const specPath = options.specPath || SPEC_PATH;
  const previewPath = options.previewPath || PREVIEW_PATH;

  if (!fs.existsSync(approvalPath)) {
    throw new Error('APPROVAL_MISSING: .booking/rich-menu/approval.json does not exist. Human approval required before publishing.');
  }

  if (!fs.existsSync(specPath)) {
    throw new Error(`SPEC_MISSING: Spec file ${specPath} not found.`);
  }

  if (!fs.existsSync(previewPath)) {
    throw new Error(`PREVIEW_MISSING: Preview image ${previewPath} not found.`);
  }

  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
  if (!approval.approved) {
    throw new Error('APPROVAL_REJECTED: approval.json indicates approved is false.');
  }

  const currentSpec = fs.readFileSync(specPath, 'utf8');
  const currentImage = fs.readFileSync(previewPath);

  const currentSpecHash = computeSha256(currentSpec);
  const currentImageHash = computeSha256(currentImage);

  if (approval.specHash !== currentSpecHash) {
    throw new Error(`APPROVAL_HASH_MISMATCH: Spec hash mismatch! Approved: ${approval.specHash}, Current: ${currentSpecHash}`);
  }

  if (approval.imageHash !== currentImageHash) {
    throw new Error(`APPROVAL_HASH_MISMATCH: Image hash mismatch! Approved: ${approval.imageHash}, Current: ${currentImageHash}`);
  }

  return {
    valid: true,
    approvedAt: approval.approvedAt,
    menuName: approval.menuName,
    specHash: approval.specHash,
    imageHash: approval.imageHash
  };
}

/**
 * Creates and writes approval.json after human confirms
 */
export function createApproval(options = {}) {
  const specPath = options.specPath || SPEC_PATH;
  const previewPath = options.previewPath || PREVIEW_PATH;
  const approvalPath = options.approvalPath || APPROVAL_PATH;

  if (!fs.existsSync(specPath) || !fs.existsSync(previewPath)) {
    throw new Error('CANNOT_APPROVE: Missing spec or preview image. Run preview generation first.');
  }

  const specContent = fs.readFileSync(specPath, 'utf8');
  const imageBuffer = fs.readFileSync(previewPath);

  const spec = JSON.parse(specContent);
  const specHash = computeSha256(specContent);
  const imageHash = computeSha256(imageBuffer);

  const approvalData = {
    approved: true,
    specHash,
    imageHash,
    approvedAt: new Date().toISOString(),
    menuName: spec.name,
    chatBarText: spec.chatBarText
  };

  fs.writeFileSync(approvalPath, JSON.stringify(approvalData, null, 2), 'utf8');
  return approvalData;
}

/**
 * Generates Admin Menu Spec and Preview Image
 */
export async function generateAdminPreview(options = {}) {
  const targetsPath = options.targetsPath || TARGETS_PATH;
  if (!fs.existsSync(targetsPath)) {
    throw new Error(`TARGETS_NOT_FOUND: ${targetsPath} does not exist. Please run Ep02-0 discovery first.`);
  }

  const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
  const spec = buildAdminMenuSpec(targets, options);

  if (!fs.existsSync(RICH_MENU_DIR)) {
    fs.mkdirSync(RICH_MENU_DIR, { recursive: true });
  }

  const specPath = options.specPath || ADMIN_SPEC_PATH;
  const previewPath = options.previewPath || ADMIN_PREVIEW_PATH;

  const specContent = JSON.stringify(spec, null, 2);
  fs.writeFileSync(specPath, specContent, 'utf8');

  const { buffer, sizeBytes } = await renderMenuImage(spec, { outputPath: previewPath });

  const specHash = computeSha256(specContent);
  const imageHash = computeSha256(buffer);

  return {
    spec,
    specPath,
    previewPath,
    specHash,
    imageHash,
    sizeBytes
  };
}

/**
 * Verifies if admin-approval.json exists and hashes match current spec & image
 */
export function verifyAdminApproval(options = {}) {
  return verifyApproval({
    approvalPath: options.approvalPath || ADMIN_APPROVAL_PATH,
    specPath: options.specPath || ADMIN_SPEC_PATH,
    previewPath: options.previewPath || ADMIN_PREVIEW_PATH
  });
}

/**
 * Creates and writes admin-approval.json
 */
export function createAdminApproval(options = {}) {
  return createApproval({
    approvalPath: options.approvalPath || ADMIN_APPROVAL_PATH,
    specPath: options.specPath || ADMIN_SPEC_PATH,
    previewPath: options.previewPath || ADMIN_PREVIEW_PATH
  });
}

// Allow CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || 'preview';
  const isAdmin = process.argv.includes('--admin');

  if (cmd === 'preview') {
    const previewFn = isAdmin ? generateAdminPreview : generatePreview;
    previewFn()
      .then(({ spec, specPath, previewPath, specHash, imageHash, sizeBytes }) => {
        console.log(`--- ${isAdmin ? 'Admin' : 'Default'} Preview Generation Completed ---`);
        console.log(`Spec file: ${specPath}`);
        console.log(`Preview image: ${previewPath} (${(sizeBytes / 1024).toFixed(1)} KB)`);
        console.log(`Spec Hash: ${specHash}`);
        console.log(`Image Hash: ${imageHash}`);
        console.log('\nMenu Name:', spec.name);
        console.log('Chat Bar Text:', spec.chatBarText);
        const approveCmd = isAdmin ? 'node scripts/rich-menu/approval.mjs approve --admin' : 'node scripts/rich-menu/approval.mjs approve';
        console.log(`\nReady for human inspection! To approve, run: ${approveCmd}`);
      })
      .catch((err) => {
        console.error('Preview error:', err.message);
        process.exit(1);
      });
  } else if (cmd === 'approve') {
    try {
      const result = isAdmin ? createAdminApproval() : createApproval();
      const appPath = isAdmin ? ADMIN_APPROVAL_PATH : APPROVAL_PATH;
      console.log(`--- ${isAdmin ? 'Admin' : 'Default'} Approval Granted & Locked ---`);
      console.log(`Approval file: ${appPath}`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Approval error:', err.message);
      process.exit(1);
    }
  } else if (cmd === 'verify') {
    try {
      const result = isAdmin ? verifyAdminApproval() : verifyApproval();
      console.log(`--- ${isAdmin ? 'Admin' : 'Default'} Approval Gate Verified (PASS) ---`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Verification error:', err.message);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${cmd}. Available: preview | approve | verify [--admin]`);
    process.exit(1);
  }
}
