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
const targetPagesDomain = customDomain 
  ? customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  : 'xingnong-farm.pages.dev';

const domains = ['localhost', '127.0.0.1', targetPagesDomain];

const widgetName = `${stationName} 預約驗證`;
console.log(`📌 準備建立/配置 Turnstile Widget：`);
console.log(`   - 應用名稱: ${widgetName}`);
console.log(`   - 授權網域: ${domains.join(', ')}`);
console.log(`   - 驗證模式: Managed (智慧互動模式，正常時完全無感隱形)\n`);

// 2. 呼叫 Wrangler CLI 建立 Widget
try {
  console.log('🚀 正在透過 Cloudflare 原生 CLI 建立 Turnstile Widget...');
  const createCmd = `npx wrangler turnstile widget create "${widgetName}" --domains "${domains.join(',')}" --mode managed --json`;
  
  const result = execSync(createCmd, {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

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
    throw new Error('無法取得有效的 SiteKey 或 SecretKey，請確認 Cloudflare 帳號權限');
  }

  console.log('✅ Turnstile Widget 建立成功！');
  console.log(`   - Site Key: ${siteKey}`);
  console.log('   - Secret Key: [已安全捕獲，準備直接送入 Cloudflare 加密金鑰庫]\n');

  // 3. 安全寫入 Cloudflare Worker Secret (密鑰直接由 stdin 管道送入，絕不落地檔案、不進 Git)
  console.log('🔒 正在將 Secret 安全寫入 Cloudflare Worker Secret (Zero-Disk-Storage)...');
  const putSecret = spawnSync('npx', ['wrangler', 'secret', 'put', 'TURNSTILE_SECRET_KEY'], {
    cwd: BACKEND_DIR,
    input: secretKey + '\n',
    encoding: 'utf8',
    shell: true
  });

  if (putSecret.status !== 0) {
    throw new Error('Worker Secret 寫入失敗，請確認網路連線與 Cloudflare 權限');
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
  const errorMsg = String(error.stderr || error.stdout || error.message || '');
  if (errorMsg.includes('code: 10000') || errorMsg.includes('missing some expected Oauth scopes') || errorMsg.includes('challenge-widgets.write')) {
    console.error('\n⚠️  【Cloudflare 權限升級提示】');
    console.error('您的 Cloudflare 登入憑證缺少 Turnstile Widget 操作權限（challenge-widgets.write）。');
    console.error('\n👉 請在終端機執行一次以下指令完成升級授權（瀏覽器會彈出 Cloudflare 授權視窗，點擊「Allow」即可）：');
    console.error('   npx wrangler login\n');
    console.error('授權完成後，再次執行此腳本，即可全自動為您建立並完成設定！\n');
  } else {
    console.error('\n❌ 自動建立 Turnstile 遭遇異常。');
    console.error('\n💡 備用替代方案：您也可以直接前往 Cloudflare 控制台手動建立 Turnstile Widget，並執行以下指令安全託管密鑰：');
    console.error('   1. 前端：將 Site Key 寫入 packages/frontend/.env (VITE_TURNSTILE_SITE_KEY)');
    console.error('   2. 後端：在 packages/backend 執行 npx wrangler secret put TURNSTILE_SECRET_KEY');
  }
  process.exit(1);
}
