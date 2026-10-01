import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyApproval, SPEC_PATH, PREVIEW_PATH, APPROVAL_PATH, RICH_MENU_DIR } from './approval.mjs';
import { toLineRichMenuObject } from './builder.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export const MANAGED_PATH = path.join(RICH_MENU_DIR, 'managed.json');
const LINE_API_BASE = 'https://api.line.me/v2/bot';

/**
 * LINE Messaging API Client Helper
 */
export async function lineFetch(endpoint, token, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${LINE_API_BASE}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}

export async function validateRemoteRichMenu(token, lineObj, customFetch = lineFetch) {
  const res = await customFetch('/richmenu/validate', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lineObj)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LINE_VALIDATE_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return true;
}

export async function getCurrentRemoteDefault(token, customFetch = lineFetch) {
  const res = await customFetch('/user/all/richmenu', token, {
    method: 'GET'
  });

  if (res.status === 200) {
    const data = await res.json();
    return data.richMenuId || null;
  }
  if (res.status === 404 || res.status === 403) {
    return null; // No default set via API (or set via OA Manager)
  }
  const errorText = await res.text();
  throw new Error(`LINE_GET_DEFAULT_FAILED: HTTP ${res.status} - ${errorText}`);
}

export async function createRemoteRichMenu(token, lineObj, customFetch = lineFetch) {
  const res = await customFetch('/richmenu', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lineObj)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LINE_CREATE_MENU_FAILED: HTTP ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return data.richMenuId;
}

export async function uploadRemoteRichMenuImage(token, richMenuId, imageBuffer, mimeType = 'image/png', customFetch = lineFetch) {
  const res = await customFetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, token, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType
    },
    body: imageBuffer
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LINE_UPLOAD_IMAGE_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return true;
}

export async function setRemoteDefaultRichMenu(token, richMenuId, customFetch = lineFetch) {
  const res = await customFetch(`/user/all/richmenu/${richMenuId}`, token, {
    method: 'POST'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LINE_SET_DEFAULT_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return true;
}

export async function deleteRemoteDefaultRichMenu(token, customFetch = lineFetch) {
  const res = await customFetch('/user/all/richmenu', token, {
    method: 'DELETE'
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`LINE_DELETE_DEFAULT_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return true;
}

export async function deleteRemoteRichMenu(token, richMenuId, customFetch = lineFetch) {
  const res = await customFetch(`/richmenu/${richMenuId}`, token, {
    method: 'DELETE'
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`LINE_DELETE_MENU_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return true;
}

/**
 * Main Publisher Execution
 */
export async function runPublisher(options = {}) {
  const dryRun = !!options.dryRun;
  const token = options.token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const customFetch = options.customFetch || lineFetch;

  if (!token) {
    throw new Error('OPERATION_TOKEN_REQUIRED: LINE_CHANNEL_ACCESS_TOKEN must be provided to run publisher.');
  }

  // Step 1: Strict Approval Gate Verification
  const approval = verifyApproval({
    approvalPath: options.approvalPath || APPROVAL_PATH,
    specPath: options.specPath || SPEC_PATH,
    previewPath: options.previewPath || PREVIEW_PATH
  });

  const spec = JSON.parse(fs.readFileSync(options.specPath || SPEC_PATH, 'utf8'));
  const imageBuffer = fs.readFileSync(options.previewPath || PREVIEW_PATH);
  const lineObj = toLineRichMenuObject(spec);

  // Step 2: Remote Pre-validation
  await validateRemoteRichMenu(token, lineObj, customFetch);

  // Step 3: Inspect previous default
  const previousDefaultMenuId = await getCurrentRemoteDefault(token, customFetch);

  if (dryRun) {
    return {
      success: true,
      mode: 'dry-run',
      approval,
      previousDefaultMenuId,
      lineObj,
      message: 'Dry-run preflight validated successfully. No remote resources created.'
    };
  }

  // Step 4: Atomic Creation
  const newRichMenuId = await createRemoteRichMenu(token, lineObj, customFetch);

  try {
    // Step 5: Upload Image
    await uploadRemoteRichMenuImage(token, newRichMenuId, imageBuffer, 'image/png', customFetch);

    // Step 6: Set New Default
    await setRemoteDefaultRichMenu(token, newRichMenuId, customFetch);

    // Step 7: Verify Default
    const verifiedDefault = await getCurrentRemoteDefault(token, customFetch);
    if (verifiedDefault !== newRichMenuId) {
      throw new Error(`VERIFY_DEFAULT_FAILED: Expected default ${newRichMenuId}, got ${verifiedDefault}`);
    }

    // Step 8: Record Managed Operational Metadata
    const managedData = {
      status: 'active',
      currentMenuId: newRichMenuId,
      previousMenuId: previousDefaultMenuId,
      menuName: spec.name,
      chatBarText: spec.chatBarText,
      specHash: approval.specHash,
      imageHash: approval.imageHash,
      deployedAt: new Date().toISOString()
    };

    const managedPath = options.managedPath || MANAGED_PATH;
    fs.writeFileSync(managedPath, JSON.stringify(managedData, null, 2), 'utf8');

    return {
      success: true,
      mode: 'published',
      newRichMenuId,
      previousDefaultMenuId,
      managedData
    };
  } catch (err) {
    // Attempt cleanup of failed orphaned menu
    try {
      await deleteRemoteRichMenu(token, newRichMenuId, customFetch);
    } catch {
      // Ignore cleanup error
    }
    throw err;
  }
}

// Allow CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDryRun = process.argv.includes('--dry-run');

  runPublisher({ dryRun: isDryRun })
    .then((res) => {
      console.log('Publisher Execution Result:');
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error('Publisher Error:', err.message);
      process.exit(1);
    });
}
