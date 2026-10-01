import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lineFetch,
  MANAGED_PATH,
  setRemoteDefaultRichMenu,
  deleteRemoteDefaultRichMenu,
  deleteRemoteRichMenu,
  getCurrentRemoteDefault
} from './publisher.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export async function runRollback(options = {}) {
  const token = options.token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const customFetch = options.customFetch || lineFetch;
  const managedPath = options.managedPath || MANAGED_PATH;

  if (!token) {
    throw new Error('OPERATION_TOKEN_REQUIRED: LINE_CHANNEL_ACCESS_TOKEN must be provided to run rollback.');
  }

  if (!fs.existsSync(managedPath)) {
    throw new Error(`MANAGED_FILE_NOT_FOUND: ${managedPath} not found. Nothing to rollback.`);
  }

  const managed = JSON.parse(fs.readFileSync(managedPath, 'utf8'));
  const { currentMenuId, previousMenuId, pendingMenuId, failedMenuId } = managed;

  if (managed.status === 'rolled-back') {
    throw new Error('ALREADY_ROLLED_BACK: Managed state indicates rich menu has already been rolled back. Refusing to repeat rollback to prevent deleting active menu.');
  }

  const menuToDelete = currentMenuId || pendingMenuId || failedMenuId;
  if (!menuToDelete && !previousMenuId) {
    throw new Error('NOTHING_TO_ROLLBACK: No active or pending menu ID found in managed state.');
  }

  let rollbackAction = '';

  // Scenario A: Previous API Default Existed
  if (previousMenuId) {
    rollbackAction = `Restored previous API default rich menu (${previousMenuId})`;
    await setRemoteDefaultRichMenu(token, previousMenuId, customFetch);
  } else {
    // Scenario B & C: Previous was OA Manager default or No default -> Clear API default
    rollbackAction = 'Cleared API default rich menu (reverted to OA Manager default or clean state)';
    await deleteRemoteDefaultRichMenu(token, customFetch);
  }

  // Delete current/pending deployed rich menu to prevent orphaned resources
  if (menuToDelete) {
    await deleteRemoteRichMenu(token, menuToDelete, customFetch);
  }

  // Verify remote state after rollback (Fail-Closed)
  const remoteDefaultAfter = await getCurrentRemoteDefault(token, customFetch);
  const expectedDefault = previousMenuId || null;
  if (remoteDefaultAfter !== expectedDefault) {
    throw new Error(`ROLLBACK_VERIFY_FAILED: Remote default does not match expected state. Expected: ${expectedDefault}, got: ${remoteDefaultAfter}`);
  }

  // Update managed status safely
  managed.status = 'rolled-back';
  managed.rolledBackAt = new Date().toISOString();
  managed.rollbackAction = rollbackAction;
  managed.rolledBackMenuId = menuToDelete;
  managed.currentMenuId = null; // Clear so subsequent runs cannot delete the restored menu
  fs.writeFileSync(managedPath, JSON.stringify(managed, null, 2), 'utf8');

  return {
    success: true,
    rollbackAction,
    revertedDefault: previousMenuId,
    verifiedRemoteDefault: remoteDefaultAfter,
    deletedMenuId: menuToDelete
  };
}

// Allow CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRollback()
    .then((res) => {
      console.log('Rollback Completed:');
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error('Rollback Error:', err.message);
      process.exit(1);
    });
}
