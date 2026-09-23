const fs = require('fs');
const path = require('path');

// 驗證輕量初階版本：確保不含任何照片上傳/檔案上傳相依性與介面
const targetFiles = [
  path.join(__dirname, '../packages/shared/types.ts'),
  path.join(__dirname, '../packages/frontend/src/components/ApplyForm.tsx'),
  path.join(__dirname, '../packages/frontend/src/components/AdminDashboard.tsx'),
  path.join(__dirname, '../packages/backend/src/line.ts'),
  path.join(__dirname, '../packages/backend/src/index.ts')
];

let hasError = false;

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 找不到必要檔案: ${filePath}`);
    hasError = true;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('type="file"') || content.includes('photo_url') || content.includes('r2_bucket') || content.includes('uploadPhoto')) {
    console.error(`❌ 檔案包含照片上傳相依性: ${filePath}`);
    hasError = true;
  }
}

if (hasError) {
  console.error('❌ 驗證失敗：初階版專案中存在照片上傳相關代碼');
  process.exit(1);
} else {
  console.log('✅ 驗證成功：所有模組均為純文字輕量初階版，無任何照片上傳或 R2 儲存相依。');
}
