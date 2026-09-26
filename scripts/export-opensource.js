const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXPORT_DIR = process.argv[2] 
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(ROOT_DIR, '../biz-resource-reservation-public');

console.log('🚀 開始執行開源版本導出程序...');
console.log(`📁 來源目錄: ${ROOT_DIR}`);
console.log(`📦 目標開源目錄: ${EXPORT_DIR}`);

// 排除的檔案與資料夾
const IGNORE_LIST = [
  '.git',
  '.codex',
  '.netlify',
  '.wrangler',
  '.playwright-cli',
  '.playwright-mcp',
  'node_modules',
  'dist',
  '.output',
  'build',
  'status.md',
  'DEMO_HANDOFF.md',
  '.env',
  '.env.local',
  'export-opensource.js'
];

function copyAndSanitize(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_LIST.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyAndSanitize(srcPath, destPath);
    } else {
      let content = fs.readFileSync(srcPath, 'utf8');

      // 針對特定檔案進行去識別化清理
      if (srcPath.endsWith('wrangler.toml') && !srcPath.endsWith('.example')) {
        content = content
          .replace(/database_id\s*=\s*"[^"]*"/, 'database_id = "your-cloudflare-d1-database-id"')
          .replace(/ADMIN_NOTIFY_USER_ID\s*=\s*"[^"]*"/, 'ADMIN_NOTIFY_USER_ID = "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"')
          .replace(/ADMIN_LINE_IDS\s*=\s*"[^"]*"/, 'ADMIN_LINE_IDS = "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"')
          .replace(/LINE_LOGIN_CHANNEL_ID\s*=\s*"[^"]*"/, 'LINE_LOGIN_CHANNEL_ID = "2000000000"')
          .replace(/LIFF_ID\s*=\s*"[^"]*"/, 'LIFF_ID = "2000000000-XXXXXXXX"')
          .replace(/STATION_NAME\s*=\s*"[^"]*"/, 'STATION_NAME = "示範農場服務站"')
          .replace(/ALLOWED_ORIGINS\s*=\s*"[^"]*"/, 'ALLOWED_ORIGINS = "https://*.pages.dev"');
      }

      if (srcPath.endsWith('config.ts')) {
        content = content.replace(
          /'https:\/\/line-bot-farm-api\.chingfon-lee\.workers\.dev'/,
          "'https://line-bot-farm-api.your-subdomain.workers.dev'"
        );
      }

      if (srcPath.endsWith('AdminDashboard.tsx') || srcPath.endsWith('ApplyForm.tsx')) {
        content = content.replace(
          /const LIFF_ID = \(import\.meta\.env\.VITE_LIFF_ID as string\) \|\| '[^']*';/,
          "const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string) || '';"
        );
      }

      if (srcPath.endsWith('line.ts') || srcPath.endsWith('index.ts')) {
        content = content.replace(/2011709076-09FdfkjH/g, '2000000000-XXXXXXXX');
      }

      if (srcPath.endsWith('package.json') && path.dirname(srcPath) === ROOT_DIR) {
        content = content.replace(/"name":\s*"line-bot-farm"/, '"name": "open-booking-line"');
      }

      if (srcPath.endsWith('.md')) {
        content = content
          .replace(/U7c0c955[a-zA-Z0-9.]+/g, 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
          .replace(/2011709076-09FdfkjH/g, '2000000000-XXXXXXXX')
          .replace(/2011709076/g, '2000000000')
          .replace(/9ab7d6d6-6e29-421b-8674-6e6bf0d3e770/g, 'your-cloudflare-d1-database-id')
          .replace(/chingfonlee\/biz-resource-reservation/g, 'chingfonlee/open-booking-line')
          .replace(/biz-resource-reservation/g, 'open-booking-line')
          .replace(/line-bot-farm\//g, 'open-booking-line/');
      }

      fs.writeFileSync(destPath, content, 'utf8');
    }
  }
}

// 清理目標目錄中已不存在於來源的檔案（保留 .git 目錄）
function cleanDest(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

cleanDest(EXPORT_DIR);
copyAndSanitize(ROOT_DIR, EXPORT_DIR);
console.log('✅ 檔案已成功複製並完成隱私去識別化清理！');

// 初始化開源獨立 Git 倉庫
try {
  const isGitRepo = fs.existsSync(path.join(EXPORT_DIR, '.git'));
  if (!isGitRepo) {
    console.log('🌱 初始化全新開源 Git 倉庫...');
    execSync('git init', { cwd: EXPORT_DIR, stdio: 'ignore' });
    execSync('git branch -M main', { cwd: EXPORT_DIR, stdio: 'ignore' });
  }

  execSync('git add .', { cwd: EXPORT_DIR, stdio: 'ignore' });
  try {
    execSync('git commit -m "feat: initial open source release (v1.0.0)"', { cwd: EXPORT_DIR, stdio: 'ignore' });
    console.log('✅ 已建立乾淨的初始開源 Commit！');
  } catch {
    console.log('ℹ️ 目標倉庫無檔案變更需要 commit。');
  }

  console.log('\n======================================================');
  console.log('🎉 開源版本已準備就緒！');
  console.log(`目錄位置：${EXPORT_DIR}`);
  console.log('後續發布至公開 GitHub 倉庫步驟：');
  console.log('1. 在 GitHub 建立一個全新的 Public 倉庫（例如 open-booking-line）');
  console.log(`2. cd "${EXPORT_DIR}"`);
  console.log('3. git remote add origin https://github.com/chingfonlee/open-booking-line.git');
  console.log('4. git push -u origin main');
  console.log('======================================================\n');
} catch (err) {
  console.warn('Git 初始化提示:', err.message);
}
