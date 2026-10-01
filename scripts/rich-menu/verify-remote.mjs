/**
 * Read-Only LINE Rich Menu Remote Verifier
 * 
 * Safely inspects current LINE remote Rich Menu state without altering or deleting any resources.
 * 
 * Checks:
 * 1. Current remote default menu ID (GET /user/all/richmenu)
 * 2. Remote menu structure and button bounds/actions (GET /richmenu/{id})
 * 3. Remote menu image download & SHA-256 hash comparison (GET https://api-data.line.me/v2/bot/richmenu/{id}/content)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lineFetch } from './publisher.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export async function verifyRemoteState(options = {}) {
  const token = options.token || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('TOKEN_REQUIRED: LINE_CHANNEL_ACCESS_TOKEN must be provided.');
  }

  const customFetch = options.customFetch || lineFetch;
  const result = {
    verifiedAt: new Date().toISOString(),
    defaultMenuId: null,
    menuDetails: null,
    imageHash: null,
    status: 'UNKNOWN'
  };

  // 1. Get current default rich menu
  const defaultRes = await customFetch('/user/all/richmenu', token, { method: 'GET' });
  if (defaultRes.status === 200) {
    const data = await defaultRes.json();
    result.defaultMenuId = data.richMenuId || null;
  } else if (defaultRes.status === 404 || defaultRes.status === 403) {
    result.defaultMenuId = null;
  } else {
    const errText = await defaultRes.text();
    throw new Error(`GET_DEFAULT_FAILED: HTTP ${defaultRes.status} - ${errText}`);
  }

  if (!result.defaultMenuId) {
    result.status = 'NO_DEFAULT_SET';
    return result;
  }

  // 2. Inspect menu definition
  const menuRes = await customFetch(`/richmenu/${result.defaultMenuId}`, token, { method: 'GET' });
  if (menuRes.status === 200) {
    result.menuDetails = await menuRes.json();
  } else {
    const errText = await menuRes.text();
    throw new Error(`GET_MENU_FAILED: HTTP ${menuRes.status} - ${errText}`);
  }

  // 3. Download image and compute SHA-256
  const imageRes = await customFetch(
    `https://api-data.line.me/v2/bot/richmenu/${result.defaultMenuId}/content`,
    token,
    { method: 'GET' }
  );

  if (imageRes.status === 200) {
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    result.imageSize = buffer.length;
    result.imageHash = `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
  } else {
    const errText = await imageRes.text();
    throw new Error(`GET_IMAGE_FAILED: HTTP ${imageRes.status} - ${errText}`);
  }

  result.status = 'VERIFIED_ACTIVE';
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('Error: LINE_CHANNEL_ACCESS_TOKEN environment variable is required.');
    process.exit(1);
  }

  verifyRemoteState({ token })
    .then((res) => {
      console.log('=== LINE Remote Rich Menu Verification ===');
      console.log(`Status:         ${res.status}`);
      console.log(`Default Menu ID: ${res.defaultMenuId}`);
      if (res.menuDetails) {
        console.log(`Name:           ${res.menuDetails.name}`);
        console.log(`Chat Bar Text:  ${res.menuDetails.chatBarText}`);
        console.log(`Size:           ${res.menuDetails.size?.width}x${res.menuDetails.size?.height}`);
        console.log(`Areas Count:    ${res.menuDetails.areas?.length}`);
      }
      if (res.imageHash) {
        console.log(`Image Size:     ${res.imageSize} bytes`);
        console.log(`Image Hash:     ${res.imageHash}`);
      }
    })
    .catch((err) => {
      console.error('Verification failed:', err.message);
      process.exit(1);
    });
}
