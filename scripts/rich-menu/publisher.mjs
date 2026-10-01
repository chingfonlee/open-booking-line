import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyApproval, SPEC_PATH, PREVIEW_PATH, APPROVAL_PATH, RICH_MENU_DIR } from './approval.mjs';
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
    // Step 5: Upload Image
    await uploadRemoteRichMenuImage(token, newRichMenuId, imageBuffer, 'image/png', customFetch);

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
