const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function build() {
  console.log('🌱 Building 行農合作社｜服務申請管理 (單一基礎版)...');

  const targets = ['starter', 'management', 'dispatch'];
  const indexHtml = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');

  // 1. Build to dist/starter (Main Demo target)
  targets.forEach(t => {
    const targetDir = path.join(distDir, t);
    console.log(`Building -> ${targetDir}`);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(path.join(targetDir, 'index.html'), indexHtml, 'utf8');
    copyFile(path.join(srcDir, 'styles.css'), path.join(targetDir, 'styles.css'));
    copyFile(path.join(srcDir, 'app.js'), path.join(targetDir, 'app.js'));
    copyFile(path.join(srcDir, 'config', 'plans.js'), path.join(targetDir, 'config', 'plans.js'));
    copyFile(path.join(srcDir, 'data', 'mockData.js'), path.join(targetDir, 'data', 'mockData.js'));
  });

  // 2. Sync to project root (for local preview and line-booking-demo site)
  console.log('Syncing to root directory...');
  fs.writeFileSync(path.join(rootDir, 'index.html'), indexHtml, 'utf8');
  copyFile(path.join(srcDir, 'styles.css'), path.join(rootDir, 'styles.css'));
  copyFile(path.join(srcDir, 'app.js'), path.join(rootDir, 'app.js'));
  copyFile(path.join(srcDir, 'config', 'plans.js'), path.join(rootDir, 'config', 'plans.js'));
  copyFile(path.join(srcDir, 'data', 'mockData.js'), path.join(rootDir, 'data', 'mockData.js'));

  console.log('✅ Build complete!');
}

build();
