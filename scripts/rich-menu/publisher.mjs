import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyApproval, verifyAdminApproval, SPEC_PATH, PREVIEW_PATH, APPROVAL_PATH, ADMIN_SPEC_PATH, ADMIN_PREVIEW_PATH, ADMIN_APPROVAL_PATH, RICH_MENU_DIR } from './approval.mjs';
import { toLineRichMenuObject, validateLineRichMenuObject } from './builder.mjs';

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

export async function getRemoteRichMenu(token, richMenuId, customFetch = lineFetch) {
  const res = await customFetch(`/richmenu/${richMenuId}`, token, {
    method: 'GET'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LINE_GET_MENU_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return await res.json();
}

export async function linkRemoteUserRichMenu(token, userId, richMenuId, customFetch = lineFetch) {
  const res = await customFetch(`/user/${userId}/richmenu/${richMenuId}`, token, {
    method: 'POST'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LINE_LINK_USER_MENU_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return true;
}

export async function unlinkRemoteUserRichMenu(token, userId, customFetch = lineFetch) {
  const res = await customFetch(`/user/${userId}/richmenu`, token, {
    method: 'DELETE'
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`LINE_UNLINK_USER_MENU_FAILED: HTTP ${res.status} - ${errorText}`);
  }
  return true;
}

export async function getRemoteUserRichMenu(token, userId, customFetch = lineFetch) {
  const res = await customFetch(`/user/${userId}/richmenu`, token, {
    method: 'GET'
  });

  if (res.status === 200) {
    const data = await res.json();
    return data.richMenuId || null;
  }
  if (res.status === 404) {
    return null;
  }
  const errorText = await res.text();
  throw new Error(`LINE_GET_USER_MENU_FAILED: HTTP ${res.status} - ${errorText}`);
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

  // Step 1.5: Local Schema & LINE Object Validation
  validateLineRichMenuObject(lineObj);

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

  const managedPath = options.managedPath || MANAGED_PATH;

  // Step 4: Atomic Creation
  const newRichMenuId = await createRemoteRichMenu(token, lineObj, customFetch);

  // Pre-persist staging state to ensure interrupted runs can be tracked and rolled back (Fail-Closed)
  const stagingData = {
    status: 'deploying',
    pendingMenuId: newRichMenuId,
    previousMenuId: previousDefaultMenuId,
    ownedMenuIds: [newRichMenuId],
    menuName: spec.name,
    specHash: approval.specHash,
    imageHash: approval.imageHash,
    startedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(managedPath, JSON.stringify(stagingData, null, 2), 'utf8');
  } catch (persistErr) {
    // If staging state cannot be persisted, fail closed immediately and clean up remote menu
    await deleteRemoteRichMenu(token, newRichMenuId, customFetch).catch(() => {});
    throw new Error(`STAGING_PERSIST_FAILED: Could not persist deployment staging state: ${persistErr.message}`);
  }

  let defaultSwitched = false;

  try {
    // Step 5: Upload Image with dynamically detected MIME type (PNG or JPEG)
    const isJpeg = imageBuffer.length >= 3 && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF;
    const isPng = imageBuffer.length >= 8 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47;
    const mimeType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/png';

    await uploadRemoteRichMenuImage(token, newRichMenuId, imageBuffer, mimeType, customFetch);

    // Step 5.5: Pre-switch Remote Verification (Ensure menu exists remotely before activating)
    await getRemoteRichMenu(token, newRichMenuId, customFetch);

    // Step 6: Set New Default
    try {
      await setRemoteDefaultRichMenu(token, newRichMenuId, customFetch);
      defaultSwitched = true;
    } catch (switchErr) {
      // If switch call threw (e.g. timeout / connection dropped), probe if LINE applied it anyway
      try {
        const probeDefault = await getCurrentRemoteDefault(token, customFetch);
        if (probeDefault === newRichMenuId) {
          defaultSwitched = true;
        }
      } catch (probeErr) {
        // Probe also failed; remote default status is completely unknown
        switchErr.probeError = probeErr.message;
      }
      throw switchErr;
    }

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
      ownedMenuIds: [newRichMenuId],
      menuName: spec.name,
      chatBarText: spec.chatBarText,
      specHash: approval.specHash,
      imageHash: approval.imageHash,
      deployedAt: new Date().toISOString()
    };

    fs.writeFileSync(managedPath, JSON.stringify(managedData, null, 2), 'utf8');

    return {
      success: true,
      mode: 'published',
      newRichMenuId,
      previousDefaultMenuId,
      managedData
    };
  } catch (err) {
    let defaultRestored = false;
    let restorationError = null;

    // Check if default was switched or if it is currently pointing to newRichMenuId
    let needsRevert = defaultSwitched;
    let switchStateUnknown = false;

    if (!needsRevert) {
      try {
        const probeCurrent = await getCurrentRemoteDefault(token, customFetch);
        if (probeCurrent === newRichMenuId) {
          needsRevert = true;
        }
      } catch (probeErr) {
        // Query failed; remote state is unknown!
        switchStateUnknown = true;
        restorationError = `Unknown remote default state (probe failed: ${probeErr.message})`;
      }
    }

    // If default was switched (or needs reversion), attempt restoring previous default
    if (needsRevert) {
      try {
        if (previousDefaultMenuId) {
          await setRemoteDefaultRichMenu(token, previousDefaultMenuId, customFetch);
        } else {
          await deleteRemoteDefaultRichMenu(token, customFetch);
        }

        // Verify restoration actually succeeded (do NOT swallow verification errors!)
        try {
          const restoredCheck = await getCurrentRemoteDefault(token, customFetch);
          const expectedTarget = previousDefaultMenuId || null;
          if (restoredCheck === expectedTarget) {
            defaultRestored = true;
          } else {
            restorationError = `Restoration mismatch: expected ${expectedTarget}, got ${restoredCheck}`;
          }
        } catch (verifyProbeErr) {
          restorationError = `Restoration verification failed (probe error: ${verifyProbeErr.message})`;
        }
      } catch (restoreErr) {
        restorationError = restoreErr.message;
        console.error('[Publisher Recovery] Failed to restore previous default:', restoreErr.message);
      }
    } else if (switchStateUnknown) {
      // Switch state is unknown, so we CANNOT assume default was never changed!
      defaultRestored = false;
      console.error('[Publisher Recovery] Cannot determine if default was switched due to remote probe error.');
    } else {
      defaultRestored = true; // Confirmed default was never changed
    }

    // Attempt cleanup of failed orphaned menu ONLY if it is confirmed NOT to be the active default
    if (defaultRestored) {
      try {
        await deleteRemoteRichMenu(token, newRichMenuId, customFetch);
      } catch {
        // Ignore cleanup error
      }
    } else {
      console.error(`[Publisher Recovery] Refusing to delete ${newRichMenuId} because previous default could not be confirmed restored or state is unknown.`);
    }

    // Record failure in managed state
    try {
      const failedData = {
        status: 'failed',
        failedMenuId: newRichMenuId,
        previousMenuId: previousDefaultMenuId,
        defaultRestored,
        restorationError,
        error: err.message,
        failedAt: new Date().toISOString()
      };
      fs.writeFileSync(managedPath, JSON.stringify(failedData, null, 2), 'utf8');
    } catch {}

    throw err;
  }
}

/**
 * Admin Per-User Menu Publisher Execution
 */
export async function runAdminPublisher(options = {}) {
  const token = options.token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('OPERATION_TOKEN_REQUIRED: LINE_CHANNEL_ACCESS_TOKEN must be provided to run admin publisher.');
  }

  const customFetch = options.customFetch || lineFetch;
  const dryRun = Boolean(options.dryRun);

  // Step 1: Verify Admin Approval Gate
  const approval = verifyAdminApproval({
    approvalPath: options.approvalPath || ADMIN_APPROVAL_PATH,
    specPath: options.specPath || ADMIN_SPEC_PATH,
    previewPath: options.previewPath || ADMIN_PREVIEW_PATH
  });

  const spec = JSON.parse(fs.readFileSync(options.specPath || ADMIN_SPEC_PATH, 'utf8'));
  const imageBuffer = fs.readFileSync(options.previewPath || ADMIN_PREVIEW_PATH);
  const lineObj = toLineRichMenuObject(spec);

  // Step 2: Validate Remote Object against LINE API validator
  await validateRemoteRichMenu(token, lineObj, customFetch);

  // Target Admin Users to link (from options.userIds, or process.env.ADMIN_LINE_IDS)
  const targetUserIds = options.userIds || [
    ...(process.env.ADMIN_LINE_IDS ? process.env.ADMIN_LINE_IDS.split(',').map(s => s.trim()) : []),
    process.env.ADMIN_NOTIFY_USER_ID
  ].filter(Boolean);

  if (dryRun) {
    return {
      success: true,
      mode: 'admin-dry-run',
      approval,
      targetUserIds,
      lineObj,
      message: 'Admin dry-run preflight validated successfully. No remote resources created.'
    };
  }

  const managedPath = options.managedPath || MANAGED_PATH;

  // Step 3: Atomic Creation of Remote Admin Menu
  const adminRichMenuId = await createRemoteRichMenu(token, lineObj, customFetch);

  try {
    // Step 4: Upload Image
    const isJpeg = imageBuffer.length >= 3 && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF;
    const isPng = imageBuffer.length >= 8 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47;
    const mimeType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/png';

    await uploadRemoteRichMenuImage(token, adminRichMenuId, imageBuffer, mimeType, customFetch);
    await getRemoteRichMenu(token, adminRichMenuId, customFetch);

    // Step 5: Link to target Admin Users (if any provided)
    const linkedUsers = [];
    for (const uid of targetUserIds) {
      await linkRemoteUserRichMenu(token, uid, adminRichMenuId, customFetch);
      linkedUsers.push(uid);
    }

    // Step 6: Record Managed Metadata
    let existingManaged = {};
    if (fs.existsSync(managedPath)) {
      try {
        existingManaged = JSON.parse(fs.readFileSync(managedPath, 'utf8'));
      } catch {}
    }

    const ownedMenuIds = Array.from(new Set([...(existingManaged.ownedMenuIds || []), adminRichMenuId]));

    const updatedManaged = {
      ...existingManaged,
      adminMenuId: adminRichMenuId,
      linkedAdminUserIds: linkedUsers,
      ownedMenuIds,
      adminMenuName: spec.name,
      adminChatBarText: spec.chatBarText,
      adminSpecHash: approval.specHash,
      adminImageHash: approval.imageHash,
      adminDeployedAt: new Date().toISOString()
    };

    fs.writeFileSync(managedPath, JSON.stringify(updatedManaged, null, 2), 'utf8');

    return {
      success: true,
      mode: 'admin-published',
      adminRichMenuId,
      linkedUsers,
      managedData: updatedManaged
    };
  } catch (err) {
    try {
      await deleteRemoteRichMenu(token, adminRichMenuId, customFetch);
    } catch {}
    throw err;
  }
}

// Allow CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDryRun = process.argv.includes('--dry-run');
  const isAdmin = process.argv.includes('--admin');

  // Parse optional --uid
  let targetUserIds = null;
  const uidIdx = process.argv.indexOf('--uid');
  if (uidIdx !== -1 && process.argv[uidIdx + 1]) {
    targetUserIds = [process.argv[uidIdx + 1]];
  }

  const isUnlink = process.argv.includes('--unlink');
  if (isUnlink) {
    if (!targetUserIds || targetUserIds.length === 0) {
      console.error('Error: --unlink requires --uid <USER_ID>');
      process.exit(1);
    }
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.error('Error: LINE_CHANNEL_ACCESS_TOKEN must be provided.');
      process.exit(1);
    }
    unlinkRemoteUserRichMenu(token, targetUserIds[0])
      .then(() => {
        console.log(`Successfully unlinked user ${targetUserIds[0]} from custom rich menu (reverts to default)`);
      })
      .catch((err) => {
        console.error('Unlink error:', err.message);
        process.exit(1);
      });
  } else {
    const runPromise = isAdmin
      ? runAdminPublisher({ dryRun: isDryRun, userIds: targetUserIds })
      : runPublisher({ dryRun: isDryRun });

    runPromise
      .then((res) => {
        console.log('Publisher Execution Result:');
        console.log(JSON.stringify(res, null, 2));
      })
      .catch((err) => {
        console.error('Publisher Error:', err.message);
        process.exit(1);
      });
  }
}
