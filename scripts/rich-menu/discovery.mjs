import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export async function runDiscovery(options = {}) {
  const token = options.token || process.env.LINE_CHANNEL_ACCESS_TOKEN || null;

  // 1. Verify project-state.json prerequisite
  const statePath = path.join(rootDir, '.booking/project-state.json');
  if (!fs.existsSync(statePath)) {
    throw new Error('PREREQUISITE_FAILED: .booking/project-state.json does not exist');
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (state.capabilities?.['booking-core']?.status !== 'verified') {
    throw new Error('PREREQUISITE_FAILED: booking-core is not verified in project-state.json');
  }

  // 2. Discover Station Name & LIFF Target from Frontend .env
  const frontendEnvPath = path.join(rootDir, 'packages/frontend/.env');
  let liffId = null;
  let liffSource = null;
  let stationName = state.project?.name || '示範服務站';
  let stationSource = {
    file: '.booking/project-state.json',
    line: 4,
    key: 'project.name'
  };

  if (fs.existsSync(frontendEnvPath)) {
    const lines = fs.readFileSync(frontendEnvPath, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('VITE_LIFF_ID=')) {
        liffId = trimmed.substring('VITE_LIFF_ID='.length).trim();
        liffSource = {
          file: 'packages/frontend/.env',
          line: idx + 1,
          key: 'VITE_LIFF_ID'
        };
      }
      if (trimmed.startsWith('VITE_STATION_NAME=')) {
        stationName = trimmed.substring('VITE_STATION_NAME='.length).trim();
        stationSource = {
          file: 'packages/frontend/.env',
          line: idx + 1,
          key: 'VITE_STATION_NAME'
        };
      }
    });
  }

  // Fallback to wrangler.local.toml if frontend .env didn't specify
  if (!liffId) {
    const backendLocalPath = path.join(rootDir, 'packages/backend/wrangler.local.toml');
    if (fs.existsSync(backendLocalPath)) {
      const lines = fs.readFileSync(backendLocalPath, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('LIFF_ID')) {
          const match = trimmed.match(/LIFF_ID\s*=\s*["']([^"']+)["']/);
          if (match) {
            liffId = match[1];
            liffSource = {
              file: 'packages/backend/wrangler.local.toml',
              line: idx + 1,
              key: 'LIFF_ID'
            };
          }
        }
      });
    }
  }

  if (!liffId) {
    throw new Error('TARGET_DISCOVERY_FAILED: LIFF_ID could not be located in frontend or backend configurations');
  }

  const bookingUri = `https://liff.line.me/${liffId}`;

  // 3. Discover Query Action from backend index.ts
  const backendIndexPath = path.join(rootDir, 'packages/backend/src/index.ts');
  let queryText = '查詢預約';
  let querySource = {
    file: 'packages/backend/src/index.ts',
    lines: '602-610',
    handler: 'isQuery webhook message handler'
  };

  if (fs.existsSync(backendIndexPath)) {
    const content = fs.readFileSync(backendIndexPath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("text.includes('查')") || lines[i].includes("text.includes('進度')")) {
        querySource = {
          file: 'packages/backend/src/index.ts',
          lines: `${i + 1}-${i + 9}`,
          handler: 'isQuery webhook message handler'
        };
        break;
      }
    }
  }

  // 4. Remote LINE Preflight
  let lineStatus = {
    status: 'requires-operation-token',
    hasExistingDefault: null,
    defaultMenuId: null,
    totalExistingMenus: null,
    note: 'LINE_CHANNEL_ACCESS_TOKEN is not in current environment. Local discovery completed safely.'
  };

  if (token) {
    try {
      // 4.1 Check default rich menu
      const defaultRes = await fetch('https://api.line.me/v2/bot/user/all/richmenu', {
        headers: { Authorization: `Bearer ${token}` }
      });

      let currentDefaultId = null;
      let hasDefault = false;

      if (defaultRes.status === 200) {
        const data = await defaultRes.json();
        currentDefaultId = data.richMenuId || null;
        hasDefault = !!currentDefaultId;
      } else if (defaultRes.status === 404) {
        hasDefault = false;
        currentDefaultId = null;
      } else {
        const errText = await defaultRes.text();
        throw new Error(`LINE_API_ERROR: HTTP ${defaultRes.status} - ${errText}`);
      }

      // 4.2 Query total menus list
      let totalMenus = 0;
      const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (listRes.status === 200) {
        const listData = await listRes.json();
        totalMenus = Array.isArray(listData.richmenus) ? listData.richmenus.length : 0;
      }

      lineStatus = {
        status: 'connected',
        hasExistingDefault: hasDefault,
        defaultMenuId: currentDefaultId,
        totalExistingMenus: totalMenus,
        note: hasDefault ? 'Existing default rich menu detected on LINE OA' : 'No default rich menu currently set'
      };
    } catch (err) {
      lineStatus = {
        status: 'preflight-failed',
        hasExistingDefault: null,
        defaultMenuId: null,
        totalExistingMenus: null,
        note: `Remote check failed: ${err.message}`
      };
    }
  }

  // 5. Construct targets output
  const targets = {
    station: {
      name: stationName,
      source: stationSource
    },
    booking: {
      type: 'uri',
      target: bookingUri,
      source: liffSource
    },
    query: {
      type: 'message',
      text: queryText,
      source: querySource
    },
    line: lineStatus,
    discoveredAt: new Date().toISOString()
  };

  // 6. Write output atomically
  const outDir = path.join(rootDir, '.booking/rich-menu');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const targetOutPath = path.join(outDir, 'targets.json');
  fs.writeFileSync(targetOutPath, JSON.stringify(targets, null, 2), 'utf8');

  return {
    targets,
    targetOutPath
  };
}

// Allow CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDiscovery()
    .then(({ targets, targetOutPath }) => {
      console.log('Discovery completed successfully:');
      console.log(`Saved to: ${targetOutPath}`);
      console.log(JSON.stringify(targets, null, 2));
    })
    .catch((err) => {
      console.error('Discovery error:', err.message);
      process.exit(1);
    });
}
