const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

const forbiddenKeywords = [
  'Management',
  'Dispatch',
  'Starter',
  '管理版',
  '派工版',
  '接單版',
  '方案',
  '升級',
  '已排程',
  '確定排程',
  '派工人員',
  '機具',
  '施工中',
  'NT$500',
  'NT$990',
  'NT$1,990',
  '預約管理系統',
  '派工中心'
];

console.log('🔍 Running UI keyword audit for user-facing texts...\n');

let issues = 0;

// Helper to inspect visible text in HTML
forbiddenKeywords.forEach(kw => {
  // Check in index.html (excluding comments)
  const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  if (cleanHtml.includes(kw)) {
    console.error(`❌ Found forbidden keyword "${kw}" in index.html!`);
    issues++;
  }

  // Check in app.js string literals (excluding variable names)
  // Match user-visible strings inside templates or textContent
  const stringMatches = app.match(new RegExp(`['"\`][^'"\`]*?${kw}[^'"\`]*?['"\`]`, 'g')) || [];
  stringMatches.forEach(m => {
    // allow comments or config keys if any
    console.error(`❌ Found forbidden keyword "${kw}" in app.js string: ${m}`);
    issues++;
  });
});

if (issues === 0) {
  console.log('✅ 100% CLEAN! Zero forbidden keywords found in user-facing index.html and app.js!');
} else {
  console.error(`\nFound ${issues} keyword issues. Please review and fix.`);
  process.exit(1);
}
