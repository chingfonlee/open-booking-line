const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'packages', 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'packages', 'frontend');
const WRANGLER_TOML_PATH = path.join(BACKEND_DIR, 'wrangler.toml');
const FRONTEND_ENV_PATH = path.join(FRONTEND_DIR, '.env');

console.log('🛡️  【Turnstile 智慧自動化配置】啟動中...\n');

// 1. 讀取現有配置 (服務站名稱與 Pages 網域)
let stationName = '農業服務站';
let customDomain = process.argv[2] || '';

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

const domains = [targetPagesDomain];

const widgetName = `${stationName} 預約驗證`;
console.log(`📌 準備建立/配置 Turnstile Widget：`);
console.log(`   - 應用名稱: ${widgetName}`);
console.log(`   - 授權網域: ${domains.join(', ')}`);
console.log(`   - 驗證模式: Managed (智慧互動模式，正常時完全無感隱形)\n`);

// 2. 呼叫 Wrangler CLI 建立 Widget (使用 spawnSync 參數陣列傳遞，防止 Command Injection)
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

try {
  console.log('🚀 正在透過 Cloudflare 原生 CLI 建立 Turnstile Widget...');
  const createRes = spawnSync(npxCmd, [
    'wrangler',
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
    const errText = String(createRes.stderr || createRes.stdout || '');
    if (errText.includes('code: 10000') || errText.includes('missing some expected Oauth scopes') || errText.includes('challenge-widgets.write')) {
      throw new Error('OAUTH_SCOPE_MISSING');
    }
    throw new Error('WIDGET_CREATION_FAILED');
  }

  const result = createRes.stdout || '';

  let siteKey = null;
  let secretKey = null;

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

  // 3. 安全寫入 Cloudflare Worker Secret (密鑰直接由 stdin 管道送入，絕不落地檔案、不進 Git)
  console.log('🔒 正在將 Secret 安全寫入 Cloudflare Worker Secret (Zero-Disk-Storage)...');
  const putSecret = spawnSync(npxCmd, ['wrangler', 'secret', 'put', 'TURNSTILE_SECRET_KEY'], {
    cwd: BACKEND_DIR,
    input: secretKey + '\n',
    encoding: 'utf8'
  });

  if (putSecret.status !== 0) {
    throw new Error('SECRET_WRITE_FAILED');
  }
  console.log('✅ Turnstile Secret 已安全加密儲存於 Cloudflare Worker Secret！\n');

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

  // 5. 重新編譯前端並部署
  console.log('📦 正在重新打包前端應用 (npm run build)...');
  try {
    execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });
  } catch {
    throw new Error('FRONTEND_BUILD_FAILED');
  }

  console.log('\n☁️  正在重新部署前端至 Cloudflare Pages...');
  try {
    execSync('npx --prefix packages/backend wrangler pages deploy packages/frontend/dist --project-name=xingnong-farm', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
  } catch {
    throw new Error('PAGES_DEPLOY_FAILED');
  }

  console.log('\n☁️  正在重新部署後端至 Cloudflare Workers...');
  try {
    execSync('npx wrangler deploy', { cwd: BACKEND_DIR, stdio: 'inherit' });
  } catch {
    throw new Error('WORKER_DEPLOY_FAILED');
  }

  console.log('\n================================================================');
  console.log('🎉 恭喜！正式版 Cloudflare Turnstile 真人防護已全面上線！');
  console.log('🛡️  後端已自動鎖定為 Fail-Closed 密碼學防禦，全面阻絕自動化機器人與刷單爬蟲。');
  console.log('================================================================\n');

} catch (error) {
  const ERROR_DESCRIPTIONS = {
    OAUTH_SCOPE_MISSING: 'Cloudflare 憑證缺少 Turnstile Widget 操作權限',
    WIDGET_CREATION_FAILED: '建立 Turnstile Widget 失敗',
    KEYS_EXTRACTION_FAILED: '無法解析有效的 SiteKey 或 SecretKey',
    SECRET_WRITE_FAILED: 'Worker Secret 寫入失敗',
    FRONTEND_BUILD_FAILED: '前端打包編譯失敗',
    PAGES_DEPLOY_FAILED: 'Cloudflare Pages 前端部署失敗',
    WORKER_DEPLOY_FAILED: 'Cloudflare Worker 後端部署失敗'
  };

  const errorCode = (error instanceof Error ? error.message : 'UNKNOWN_ERROR');
  const errorMsg = String(error && (error.stderr || error.stdout || error.message || ''));

  if (errorCode === 'OAUTH_SCOPE_MISSING' || errorMsg.includes('code: 10000') || errorMsg.includes('missing some expected Oauth scopes') || errorMsg.includes('challenge-widgets.write')) {
    console.error('\n⚠️  【Cloudflare 權限升級提示】');
    console.error('您的 Cloudflare 登入憑證缺少 Turnstile Widget 操作權限（challenge-widgets.write）。');
    console.error('\n👉 請在終端機執行一次以下指令完成升級授權（瀏覽器會彈出 Cloudflare 授權視窗，點擊「Allow」即可）：');
    console.error('   npx wrangler login\n');
    console.error('授權完成後，再次執行此腳本，即可全自動為您建立並完成設定！\n');
  } else {
    const errorDesc = ERROR_DESCRIPTIONS[errorCode] ? ` (${ERROR_DESCRIPTIONS[errorCode]})` : '';
    console.error(`\n❌ 自動建立 Turnstile 遭遇異常：${errorCode}${errorDesc}`);
    console.error('\n💡 備用替代方案：您也可以直接前往 Cloudflare 控制台手動建立 Turnstile Widget，並執行以下指令安全託管密鑰：');
    console.error('   1. 前端：將 Site Key 寫入 packages/frontend/.env (VITE_TURNSTILE_SITE_KEY)');
    console.error('   2. 後端：在 packages/backend 執行 npx wrangler secret put TURNSTILE_SECRET_KEY\n');
  }
  process.exit(1);
}
