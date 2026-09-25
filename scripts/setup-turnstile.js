const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'packages', 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'packages', 'frontend');
const WRANGLER_TOML_PATH = path.join(BACKEND_DIR, 'wrangler.toml');
const FRONTEND_ENV_PATH = path.join(FRONTEND_DIR, '.env');

console.log('🛡️  【Turnstile 智慧自動化配置】啟動中...\n');

// 1. 讀取現有配置 (服務站名稱與 Pages 網域)
const args = process.argv.slice(2);
const isForceRecreate = args.includes('--recreate') || args.includes('--force');
let customDomain = args.find(a => !a.startsWith('--')) || '';

let stationName = '農業服務站';

if (fs.existsSync(WRANGLER_TOML_PATH)) {
  const tomlContent = fs.readFileSync(WRANGLER_TOML_PATH, 'utf8');
  const match = tomlContent.match(/STATION_NAME\s*=\s*"([^"]+)"/);
  if (match && match[1]) {
    stationName = match[1];
  }
}

// 確定授權網域清單 (Turnstile 規格：禁止 * 萬用字元，填入主要網域自動涵蓋其所有子網域如預覽部署)
// 資安最佳實踐：正式營運 Production Widget 僅限真實網域，不開放 localhost（本機測試直接走 1x...AA 測試金鑰）
const targetPagesDomain = customDomain 
  ? customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  : 'xingnong-farm.pages.dev';

const safeStationName = stationName.replace(/["`$%&;^|<>]/g, '').trim() || '農業服務站';
const safePagesDomain = targetPagesDomain.replace(/["`$%&;^|<>]/g, '').trim();
const domains = [safePagesDomain];
const widgetName = `${safeStationName} 預約驗證`;

console.log(`📌 準備建立/配置 Turnstile Widget：`);
console.log(`   - 應用名稱: ${widgetName}`);
console.log(`   - 授權網域: ${domains.join(', ')}`);
console.log(`   - 驗證模式: Managed (智慧互動模式，正常時完全無感隱形)`);
if (isForceRecreate) {
  console.log(`   - 執行模式: 強制重新建立 (--recreate)\n`);
} else {
  console.log(`   - 執行模式: 冪等復用 (自動 Reuse/Update 既有 Widget，不重複建立)\n`);
}

// 2. 解析 CLI 執行檔路徑函式（零 Shell 執行：直接使用 Node.js 執行 JS 入口點，徹底消除 Shell 注入風險）
function getWranglerCli() {
  try {
    const wranglerPkg = require.resolve('wrangler/package.json', { paths: [BACKEND_DIR] });
    return path.join(path.dirname(wranglerPkg), 'bin', 'wrangler.js');
  } catch {
    throw new Error('CLI_RESOLUTION_FAILED');
  }
}

function getNpmCli() {
  const fromNpm = process.env.npm_execpath;
  if (fromNpm && fs.existsSync(fromNpm)) {
    return fromNpm;
  }
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) {
    throw new Error('CLI_RESOLUTION_FAILED');
  }
  return found;
}

function isOAuthError(res) {
  const errText = String((res && (res.stderr || '')) + '\n' + (res && (res.stdout || '')));
  return errText.includes('code: 10000') || 
         errText.includes('missing some expected Oauth scopes') || 
         errText.includes('challenge-widgets.write');
}

function runSafe(command, args, cwd, errorCode) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    if (isOAuthError(result)) {
      throw new Error('OAUTH_SCOPE_MISSING');
    }
    throw new Error(errorCode);
  }
}

function syncWorkerSecret(wranglerCli, secretKey) {
  if (!secretKey) return;
  console.log('🔒 正在同步 Cloudflare Worker Secret (Zero-Disk-Storage)...');
  const putSecret = spawnSync(process.execPath, [wranglerCli, 'secret', 'put', 'TURNSTILE_SECRET_KEY'], {
    cwd: BACKEND_DIR,
    input: secretKey + '\n',
    encoding: 'utf8'
  });

  if (putSecret.status !== 0) {
    if (isOAuthError(putSecret)) {
      throw new Error('OAUTH_SCOPE_MISSING');
    }
    throw new Error('SECRET_WRITE_FAILED');
  }
  console.log('✅ Turnstile Secret 已安全加密儲存於 Cloudflare Worker Secret！\n');
}

try {
  // 將 CLI 解析移入主 try 區塊，確保未安裝依賴時以受控錯誤碼輸出，杜絕 raw stack trace 洩漏
  const wranglerCli = getWranglerCli();
  const npmCli = getNpmCli();

  let siteKey = null;
  let secretKey = null;

  // 讀取前端既有 Site Key (排除官方 1x / 2x / 3x 測試金鑰)
  let existingSiteKey = null;
  if (fs.existsSync(FRONTEND_ENV_PATH)) {
    const envContent = fs.readFileSync(FRONTEND_ENV_PATH, 'utf8');
    const match = envContent.match(/VITE_TURNSTILE_SITE_KEY\s*=\s*([^\s\r\n]+)/);
    if (match && match[1]) {
      const key = match[1].replace(/["']/g, '').trim();
      const isTestKey = key.startsWith('1x') || key.startsWith('2x') || key.startsWith('3x');
      if (key && !isTestKey) {
        existingSiteKey = key;
      }
    }
  }

  // 冪等檢測策略：非強制重建時，優先嘗試復用/更新既有 Widget
  if (!isForceRecreate) {
    // 優先策略 A：若本地 .env 已有正式 Site Key，直接呼叫 update 同步網域與模式
    if (existingSiteKey) {
      console.log(`🔍 偵測到本地既有 Site Key (${existingSiteKey})，正在驗證並同步遠端設定 (Reuse/Update)...`);
      const updateRes = spawnSync(process.execPath, [
        wranglerCli,
        'turnstile',
        'widget',
        'update',
        existingSiteKey,
        '--name',
        widgetName,
        '--domains',
        domains.join(','),
        '--mode',
        'managed',
        '--json'
      ], {
        cwd: BACKEND_DIR,
        encoding: 'utf8'
      });

      if (updateRes.status === 0) {
        siteKey = existingSiteKey;
        console.log(`✅ 已成功復用既有 Turnstile Widget (${siteKey})，網域與模式已同步更新！\n`);
      } else {
        if (isOAuthError(updateRes)) {
          throw new Error('OAUTH_SCOPE_MISSING');
        }
        const errText = String((updateRes.stderr || '') + '\n' + (updateRes.stdout || ''));
        if (errText.includes('404') || errText.includes('not found') || errText.includes('code: 10007')) {
          console.log('⚠️  本地記錄之 Site Key 在 Cloudflare 已不存在，將查詢既有清單或建立...\n');
        } else {
          // Fail-Closed: 非 404 之網路/API 錯誤，嚴格阻斷，不可誤落入新建
          throw new Error('WIDGET_UPDATE_FAILED');
        }
      }
    }

    // 優先策略 B：若未從本地取得有效 Site Key，查詢 Cloudflare 帳號內既有 Widget 清單
    if (!siteKey) {
      console.log('🔍 正在查詢 Cloudflare 帳號內既有 Turnstile Widget 清單以避免重複建立...');
      const listRes = spawnSync(process.execPath, [
        wranglerCli,
        'turnstile',
        'widget',
        'list',
        '--json'
      ], {
        cwd: BACKEND_DIR,
        encoding: 'utf8'
      });

      if (listRes.status !== 0) {
        if (isOAuthError(listRes)) {
          throw new Error('OAUTH_SCOPE_MISSING');
        }
        // Fail-Closed: list 查詢失敗嚴格阻斷，絕不誤建重複 Widget
        throw new Error('WIDGET_LIST_FAILED');
      }

      const listOutput = listRes.stdout || '';
      const jsonMatch = listOutput.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // Fail-Closed: API 成功但未取得有效 JSON 陣列，阻斷流程
        throw new Error('WIDGET_LIST_FAILED');
      }

      let widgets;
      try {
        widgets = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('WIDGET_LIST_FAILED');
      }

      if (!Array.isArray(widgets)) {
        throw new Error('WIDGET_LIST_FAILED');
      }

      const matched = widgets.find(w => 
        w.name === widgetName || 
        (Array.isArray(w.domains) && w.domains.includes(targetPagesDomain))
      );

      if (matched && (matched.sitekey || matched.site_key)) {
        const foundKey = matched.sitekey || matched.site_key;
        console.log(`ℹ️ 在 Cloudflare 找到相符既有 Widget (${matched.name || foundKey})，執行同步更新...`);
        const updateRes = spawnSync(process.execPath, [
          wranglerCli,
          'turnstile',
          'widget',
          'update',
          foundKey,
          '--name',
          widgetName,
          '--domains',
          domains.join(','),
          '--mode',
          'managed',
          '--json'
        ], {
          cwd: BACKEND_DIR,
          encoding: 'utf8'
        });

        if (updateRes.status !== 0) {
          if (isOAuthError(updateRes)) {
            throw new Error('OAUTH_SCOPE_MISSING');
          }
          // Fail-Closed: update 失敗嚴格阻斷，絕不退回新建
          throw new Error('WIDGET_UPDATE_FAILED');
        }

        siteKey = foundKey;
        console.log(`✅ 已成功復用既有 Turnstile Widget (${siteKey})，避免建立重複資源！\n`);
      }
    }
  }

  // 策略 C：若既有 Widget 不存在或使用者指定 --recreate，呼叫 create 建立新 Widget
  if (!siteKey) {
    console.log('🚀 正在透過 Cloudflare 原生 CLI 建立全新 Turnstile Widget...');
    const createRes = spawnSync(process.execPath, [
      wranglerCli,
      'turnstile',
      'widget',
      'create',
      widgetName,
      '--domains',
      domains.join(','),
      '--mode',
      'managed',
      '--json'
    ], {
      cwd: BACKEND_DIR,
      encoding: 'utf8'
    });

    if (createRes.status !== 0) {
      if (isOAuthError(createRes)) {
        throw new Error('OAUTH_SCOPE_MISSING');
      }
      throw new Error('WIDGET_CREATION_FAILED');
    }

    const result = createRes.stdout || '';
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const widgetData = JSON.parse(jsonMatch[0]);
        siteKey = widgetData.sitekey || widgetData.site_key;
        secretKey = widgetData.secret;
      }
    } catch {
      // 嚴格資安規範：絕不印出包含明文密鑰之 raw result
    }

    if (!siteKey || !secretKey) {
      throw new Error('KEYS_EXTRACTION_FAILED');
    }

    console.log('✅ Turnstile Widget 建立成功！');
    console.log(`   - Site Key: ${siteKey}`);
    console.log('   - Secret Key: [已安全捕獲，準備直接送入 Cloudflare 加密金鑰庫]\n');
  }

  // 自我修復 (Self-Healing)：若為復用既有 Widget，透過 widget get 重新取得 Secret 並更新 Worker Secret
  if (siteKey && !secretKey) {
    console.log(`🔒 正在獲取既有 Widget (${siteKey}) 之 Secret 進行環境自我修復...`);
    const getRes = spawnSync(process.execPath, [
      wranglerCli,
      'turnstile',
      'widget',
      'get',
      siteKey,
      '--json'
    ], {
      cwd: BACKEND_DIR,
      encoding: 'utf8'
    });

    if (getRes.status !== 0) {
      if (isOAuthError(getRes)) {
        throw new Error('OAUTH_SCOPE_MISSING');
      }
      // Fail-Closed: 取得 Secret 失敗嚴格中斷，保證金鑰完全配對
      throw new Error('WIDGET_GET_FAILED');
    }

    try {
      const jsonMatch = (getRes.stdout || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const widgetData = JSON.parse(jsonMatch[0]);
        secretKey = widgetData.secret;
      }
    } catch {
      // 保持靜默
    }

    if (!secretKey) {
      throw new Error('KEYS_EXTRACTION_FAILED');
    }
  }

  // 統一將 Secret 寫入 Cloudflare Worker Secret (Zero-Disk Storage)
  if (!secretKey) {
    throw new Error('KEYS_EXTRACTION_FAILED');
  }
  syncWorkerSecret(wranglerCli, secretKey);

  // 4. 更新前端 Site Key 至 packages/frontend/.env
  console.log('📝 正在更新前端公開 Site Key (packages/frontend/.env)...');
  let envContent = fs.existsSync(FRONTEND_ENV_PATH) ? fs.readFileSync(FRONTEND_ENV_PATH, 'utf8') : '';
  if (envContent.includes('VITE_TURNSTILE_SITE_KEY=')) {
    envContent = envContent.replace(/VITE_TURNSTILE_SITE_KEY=.*/, `VITE_TURNSTILE_SITE_KEY=${siteKey}`);
  } else {
    envContent += `\nVITE_TURNSTILE_SITE_KEY=${siteKey}\n`;
  }
  fs.writeFileSync(FRONTEND_ENV_PATH, envContent, 'utf8');
  console.log('✅ 前端 Site Key 已更新！\n');

  // 5. 重新編譯前端並部署 (全部由 Node.js 直調，零 shell 執行)
  console.log('📦 正在重新打包前端應用 (npm run build)...');
  runSafe(process.execPath, [npmCli, 'run', 'build'], FRONTEND_DIR, 'FRONTEND_BUILD_FAILED');

  console.log('\n☁️  正在重新部署前端至 Cloudflare Pages...');
  runSafe(process.execPath, [
    wranglerCli,
    'pages',
    'deploy',
    path.join(FRONTEND_DIR, 'dist'),
    '--project-name=xingnong-farm'
  ], ROOT_DIR, 'PAGES_DEPLOY_FAILED');

  console.log('\n☁️  正在重新部署後端至 Cloudflare Workers...');
  runSafe(process.execPath, [wranglerCli, 'deploy'], BACKEND_DIR, 'WORKER_DEPLOY_FAILED');

  console.log('\n================================================================');
  console.log('🎉 恭喜！正式版 Cloudflare Turnstile 真人防護已全面上線！');
  console.log('🛡️  後端已自動鎖定為 Fail-Closed 密碼學防禦，全面阻絕自動化機器人與刷單爬蟲。');
  console.log('================================================================\n');

} catch (error) {
  const ERROR_DESCRIPTIONS = {
    CLI_RESOLUTION_FAILED: '無法解析本機 Node/npm/Wrangler 執行環境',
    OAUTH_SCOPE_MISSING: 'Cloudflare 憑證缺少 Turnstile Widget 操作權限',
    WIDGET_CREATION_FAILED: '建立 Turnstile Widget 失敗',
    WIDGET_UPDATE_FAILED: '更新 Turnstile Widget 失敗',
    WIDGET_LIST_FAILED: '查詢 Turnstile Widget 清單失敗',
    WIDGET_GET_FAILED: '取得既有 Turnstile Widget Secret 失敗',
    KEYS_EXTRACTION_FAILED: '無法解析有效的 SiteKey 或 SecretKey',
    SECRET_WRITE_FAILED: 'Worker Secret 寫入失敗',
    FRONTEND_BUILD_FAILED: '前端打包編譯失敗',
    PAGES_DEPLOY_FAILED: 'Cloudflare Pages 前端部署失敗',
    WORKER_DEPLOY_FAILED: 'Cloudflare Worker 後端部署失敗'
  };

  const rawCode = error instanceof Error ? error.message : '';
  const errorCode = Object.prototype.hasOwnProperty.call(ERROR_DESCRIPTIONS, rawCode)
    ? rawCode
    : 'UNKNOWN_ERROR';

  const errorDesc = errorCode === 'UNKNOWN_ERROR'
    ? '未分類錯誤，詳細資訊已隱藏'
    : ERROR_DESCRIPTIONS[errorCode];

  const errorMsg = String(error && (error.stderr || error.stdout || error.message || ''));

  if (errorCode === 'OAUTH_SCOPE_MISSING' || errorMsg.includes('code: 10000') || errorMsg.includes('missing some expected Oauth scopes') || errorMsg.includes('challenge-widgets.write')) {
    console.error('\n⚠️  【Cloudflare 權限升級提示】');
    console.error('您的 Cloudflare 登入憑證缺少 Turnstile Widget 操作權限（challenge-widgets.write）。');
    console.error('\n👉 請在終端機執行一次以下指令完成升級授權（瀏覽器會彈出 Cloudflare 授權視窗，點擊「Allow」即可）：');
    console.error('   npx wrangler login\n');
    console.error('授權完成後，再次執行此腳本，即可全自動為您建立並完成設定！\n');
  } else {
    console.error(`\n❌ Turnstile 自動化失敗：${errorCode} (${errorDesc})`);
    console.error('\n💡 備用替代方案：您也可以直接前往 Cloudflare 控制台手動建立 Turnstile Widget，並執行以下指令安全託管密鑰：');
    console.error('   1. 前端：將 Site Key 寫入 packages/frontend/.env (VITE_TURNSTILE_SITE_KEY)');
    console.error('   2. 後端：在 packages/backend 執行 npx wrangler secret put TURNSTILE_SECRET_KEY\n');
  }
  process.exit(1);
}
