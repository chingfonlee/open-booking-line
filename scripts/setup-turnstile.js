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

// 預設關聯網域清單：包含 localhost 與 Cloudflare Pages
const domains = ['localhost'];
if (customDomain) {
  domains.push(customDomain.replace(/^https?:\/\//, '').replace(/\/$/, ''));
} else {
  // 自動從 frontend .env 或預設推測
  if (fs.existsSync(FRONTEND_ENV_PATH)) {
    const envContent = fs.readFileSync(FRONTEND_ENV_PATH, 'utf8');
    const apiMatch = envContent.match(/VITE_API_BASE_URL\s*=\s*(.+)/);
    if (apiMatch && apiMatch[1] && apiMatch[1].includes('.workers.dev')) {
      // 預設加入 pages.dev 通用網域
      domains.push('*.pages.dev');
    }
  }
  // 若未指定特定子網域，納入所有 pages.dev
  if (!domains.some(d => d.includes('pages.dev'))) {
    domains.push('*.pages.dev');
  }
}

const widgetName = `${stationName} 預約驗證`;
console.log(`📌 準備建立 Turnstile Widget：`);
console.log(`   - 應用名稱: ${widgetName}`);
console.log(`   - 授權網域: ${domains.join(', ')}`);
console.log(`   - 驗證模式: Managed (無感智慧驗證)\n`);

// 2. 呼叫 Wrangler CLI 建立 Widget
try {
  console.log('🚀 正在透過 Cloudflare API 自動建立 Turnstile Widget...');
  const createCmd = `npx wrangler turnstile widget create "${widgetName}" --domains "${domains.join(',')}" --mode managed --json`;
  
  const result = execSync(createCmd, {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let widgetData = null;
  try {
    // 擷取 JSON 區塊
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      widgetData = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('解析 JSON 輸出失敗，原始輸出:', result);
  }

  const siteKey = widgetData?.sitekey || widgetData?.site_key;
  const secretKey = widgetData?.secret;

  if (!siteKey || !secretKey) {
    throw new Error(`無法取得有效的 SiteKey 或 SecretKey。API 回傳: ${result}`);
  }

  console.log('\n✅ Turnstile Widget 建立成功！');
  console.log(`   - Site Key:   ${siteKey}`);
  console.log(`   - Secret Key: ${secretKey.slice(0, 6)}************************\n`);

  // 3. 自動更新後端 wrangler.toml
  console.log('📝 正在更新後端密鑰 (packages/backend/wrangler.toml)...');
  let tomlContent = fs.readFileSync(WRANGLER_TOML_PATH, 'utf8');
  tomlContent = tomlContent.replace(
    /TURNSTILE_SECRET_KEY\s*=\s*"[^"]*"/,
    `TURNSTILE_SECRET_KEY = "${secretKey}"`
  );
  fs.writeFileSync(WRANGLER_TOML_PATH, tomlContent, 'utf8');
  console.log('✅ 後端密鑰已更新！');

  // 4. 自動更新前端 packages/frontend/.env
  console.log('📝 正在更新前端 Site Key (packages/frontend/.env)...');
  let envContent = fs.existsSync(FRONTEND_ENV_PATH) ? fs.readFileSync(FRONTEND_ENV_PATH, 'utf8') : '';
  if (envContent.includes('VITE_TURNSTILE_SITE_KEY=')) {
    envContent = envContent.replace(/VITE_TURNSTILE_SITE_KEY=.*/, `VITE_TURNSTILE_SITE_KEY=${siteKey}`);
  } else {
    envContent += `\nVITE_TURNSTILE_SITE_KEY=${siteKey}\n`;
  }
  fs.writeFileSync(FRONTEND_ENV_PATH, envContent, 'utf8');
  console.log('✅ 前端 Site Key 已更新！');

  // 5. 重新編譯前端並部署
  console.log('\n📦 正在重新打包前端應用 (npm run build)...');
  execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });

  console.log('\n☁️  正在重新部署前端至 Cloudflare Pages...');
  execSync('npx --prefix packages/backend wrangler pages deploy packages/frontend/dist --project-name=xingnong-farm', {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  console.log('\n☁️  正在重新部署後端至 Cloudflare Workers...');
  execSync('npx wrangler deploy', { cwd: BACKEND_DIR, stdio: 'inherit' });

  console.log('\n================================================================');
  console.log('🎉 恭喜！正式版 Cloudflare Turnstile 真人防護已全面上線！');
  console.log('🛡️  後端已自動鎖定為 Fail-Closed 密碼學防禦，全面阻絕自動化機器人與刷單爬蟲。');
  console.log('================================================================\n');

} catch (error) {
  const errorMsg = error.stderr || error.stdout || error.message || '';
  if (errorMsg.includes('code: 10000') || errorMsg.includes('missing some expected Oauth scopes') || errorMsg.includes('challenge-widgets.write')) {
    console.error('\n⚠️  【OAuth 權限授權提醒】');
    console.error('您的 Cloudflare 登入權杖尚未包含 Turnstile Widget 的操作權限（challenge-widgets.write）。');
    console.error('\n👉 請在終端機執行一次以下指令完成升級授權（瀏覽器會彈出 Cloudflare 授權視窗，點擊「Allow」即可）：');
    console.error('   npx wrangler login\n');
    console.error('授權完成後，再次執行此腳本，即可全自動為您建立並完成設定！\n');
  } else {
    console.error('\n❌ 自動建立 Turnstile 遭遇異常:', errorMsg);
    console.error('\n💡 備用替代方案：您也可以直接前往 Cloudflare 控制台手動建立 Turnstile Widget，並將 Site Key 與 Secret Key 分別填入 frontend/.env 與 backend/wrangler.toml。');
  }
  process.exit(1);
}
