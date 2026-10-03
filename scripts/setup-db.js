#!/usr/bin/env node
/**
 * scripts/setup-db.js
 * 
 * EP01 Cloudflare D1 智慧資料庫引導與多帳號防呆腳本
 * 
 * 功能：
 * 1. 自動檢測 Cloudflare 帳號內既有 D1 資料庫
 * 2. 若已有資料庫，主動詢問使用者：
 *    - 【選項 1】建立全新獨立資料庫 (推薦：不同店家/官方帳號資料徹底隔離)
 *    - 【選項 2】沿用既有資料庫 (同店家維護或重新部署)
 * 3. 自動更新 packages/backend/wrangler.toml 之 [[d1_databases]] binding
 * 4. 自動執行 schema.sql 建立資料庫表格
 * 5. 執行關鍵防呆預檢：
 *    - LIFF_ID 前綴與 LINE_LOGIN_CHANNEL_ID 一致性檢驗（防止 431 vs 419 等致命驗證錯誤）
 *    - Worker 名稱衝突預檢（避免覆蓋同帳號下的其他服務站）
 *    - Turnstile 密鑰狀態檢核
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'packages', 'backend');
const WRANGLER_TOML_PATH = path.join(BACKEND_DIR, 'wrangler.toml');
const SCHEMA_SQL_PATH = path.join(BACKEND_DIR, 'schema.sql');
const EP03_MIGRATION_PATH = path.join(BACKEND_DIR, 'migrations', '0002_ep03_availability_schema.sql');

// 取得 Wrangler CLI 執行路徑 (免全域安裝，優先使用 backend 本地相依)
function getWranglerCli() {
  try {
    const pkg = require.resolve('wrangler/package.json', { paths: [BACKEND_DIR, ROOT_DIR] });
    return path.join(path.dirname(pkg), 'bin', 'wrangler.js');
  } catch {
    return 'wrangler';
  }
}

// 執行 Wrangler 指令輔助函式
function runWrangler(args, options = {}) {
  const cli = getWranglerCli();
  const isDirectJs = cli.endsWith('.js');
  const command = isDirectJs ? process.execPath : cli;
  const fullArgs = isDirectJs ? [cli, ...args] : args;

  return spawnSync(command, fullArgs, {
    cwd: options.cwd || BACKEND_DIR,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.stdio || 'pipe'
  });
}

// 解析 wrangler d1 list 的輸出
function parseD1ListJson(rawOutput) {
  if (!rawOutput) return [];
  try {
    // 優先嘗試直接解析純 JSON
    const parsed = JSON.parse(rawOutput);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // 若 Wrangler 輸出夾雜了邊框或 ASCII 藝術文字，提取最外層方括號
  const match = rawOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

// 檢查 LIFF_ID 前綴與 LINE_LOGIN_CHANNEL_ID 一致性
function checkLiffIdConsistency(liffId, lineLoginChannelId) {
  if (!liffId || !lineLoginChannelId) {
    return { valid: true, warning: '未完整提供 LIFF_ID 或 LINE_LOGIN_CHANNEL_ID，跳過比對' };
  }
  const cleanLiff = liffId.trim();
  const cleanChannelId = lineLoginChannelId.trim();
  const prefix = cleanLiff.split('-')[0];

  if (prefix !== cleanChannelId) {
    return {
      valid: false,
      liffPrefix: prefix,
      channelId: cleanChannelId,
      error: `LIFF_ID 前綴 (${prefix}) 與 LINE_LOGIN_CHANNEL_ID (${cleanChannelId}) 不相符！LINE 官方 OAuth 將會拒絕前端身份驗證，導致送單無法綁定 User ID、收不到確認卡片且無法查詢！`
    };
  }
  return { valid: true, prefix };
}

// 更新 wrangler.toml 中的資料庫設定
function updateWranglerTomlDatabase(tomlContent, dbName, dbId) {
  let updated = tomlContent;

  // 替換 database_name
  if (/database_name\s*=\s*"[^"]*"/.test(updated)) {
    updated = updated.replace(/database_name\s*=\s*"[^"]*"/, `database_name = "${dbName}"`);
  } else {
    updated = updated.replace(/\[\[d1_databases\]\]/, `[[d1_databases]]\ndatabase_name = "${dbName}"`);
  }

  // 替換 database_id
  if (/database_id\s*=\s*"[^"]*"/.test(updated)) {
    updated = updated.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${dbId}"`);
  } else {
    updated = updated.replace(/database_name\s*=\s*"[^"]*"/, `database_name = "${dbName}"\ndatabase_id = "${dbId}"`);
  }

  return updated;
}

// 終端機提問函式
function promptQuestion(rl, query) {
  return new Promise(resolve => rl.question(query, answer => resolve(answer.trim())));
}

// 主要執行入口
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌱  【open-booking-line】EP01 Cloudflare D1 資料庫智慧引導與防呆');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. 檢查 wrangler.toml 是否存在
  if (!fs.existsSync(WRANGLER_TOML_PATH)) {
    console.error('❌ 找不到 packages/backend/wrangler.toml 檔案！');
    process.exit(1);
  }
  const tomlContent = fs.readFileSync(WRANGLER_TOML_PATH, 'utf8');

  // 讀取當前設定名稱
  const stationNameMatch = tomlContent.match(/STATION_NAME\s*=\s*"([^"]+)"/);
  const stationName = stationNameMatch ? stationNameMatch[1] : '預約服務站';
  const workerNameMatch = tomlContent.match(/name\s*=\s*"([^"]+)"/);
  const workerName = workerNameMatch ? workerNameMatch[1] : 'open-booking-line-api';

  console.log(`📌 目標服務站: ${stationName}`);
  console.log(`📌 Worker 名稱: ${workerName}\n`);

  // 2. 獲取 Cloudflare D1 資料庫清單
  console.log('🔍 正在連線 Cloudflare 探測現有 D1 資料庫清單...');
  const listResult = runWrangler(['d1', 'list', '--json']);

  if (listResult.status !== 0) {
    console.error('\n❌ 無法取得 Cloudflare D1 清單。請確認是否已登入 Wrangler (可執行 npx wrangler login)。');
    if (listResult.stderr) console.error('詳細錯誤:', listResult.stderr);
    process.exit(1);
  }

  const existingDbs = parseD1ListJson(listResult.stdout);
  console.log(`✅ 成功連線！帳號內目前共有 ${existingDbs.length} 個 D1 資料庫。\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let selectedDbName = '';
  let selectedDbId = '';

  try {
    if (existingDbs.length === 0) {
      // 情況 A：無任何既有資料庫，引導建立第一個
      console.log('💡 偵測到您尚未建立任何 D1 資料庫，系統將為您建立全新專用資料庫。');
      const defaultName = 'open-booking-db';
      const inputName = await promptQuestion(rl, `請輸入資料庫名稱 (直接按 Enter 預設為 "${defaultName}"): `);
      selectedDbName = inputName || defaultName;

      console.log(`\n🚀 正在建立新資料庫 "${selectedDbName}"...`);
      const createRes = runWrangler(['d1', 'create', selectedDbName, '--json']);
      if (createRes.status !== 0) {
        console.error('❌ 資料庫建立失敗:', createRes.stderr || createRes.stdout);
        process.exit(1);
      }
      const createData = parseD1ListJson(createRes.stdout)[0] || JSON.parse(createRes.stdout || '{}');
      selectedDbId = createData.uuid || createData.database_id;
    } else {
      // 情況 B：已存在既有資料庫，展示選單並主動詢問使用者決策
      console.log('📋 【已存在的 Cloudflare D1 資料庫清單】：');
      existingDbs.forEach((db, idx) => {
        console.log(`   [${idx + 1}] ${db.name.padEnd(20)} (UUID: ${db.uuid})`);
      });
      console.log('');
      console.log('❓ 請選擇處理方式：');
      console.log('   [1] 建立全新獨立資料庫 (強烈推薦！不同官方帳號/店家資料完全獨立，防資料混雜)');
      console.log('   [2] 沿用現有的既有資料庫 (適用於同店家重新部署或修復)\n');

      const modeChoice = await promptQuestion(rl, '請輸入選項 (1 或 2，預設為 1): ');

      if (modeChoice === '2') {
        // 使用者選擇沿用既有 DB
        let dbIndex = -1;
        while (dbIndex < 0 || dbIndex >= existingDbs.length) {
          const idxStr = await promptQuestion(rl, `請選擇要連接的資料庫編號 (1 ~ ${existingDbs.length}): `);
          const parsed = parseInt(idxStr, 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= existingDbs.length) {
            dbIndex = parsed - 1;
          } else {
            console.log('⚠️ 輸入無效，請輸入正確的編號。');
          }
        }
        selectedDbName = existingDbs[dbIndex].name;
        selectedDbId = existingDbs[dbIndex].uuid;
        console.log(`\n🔗 已選擇沿用既有資料庫: ${selectedDbName} (${selectedDbId})`);
      } else {
        // 使用者選擇建立全新獨立 DB
        console.log('\n✨ 建立全新獨立資料庫模式');
        const defaultName = `${workerName.replace(/-api$/, '')}-db`;
        const inputName = await promptQuestion(rl, `請輸入新資料庫名稱 (直接按 Enter 預設為 "${defaultName}"): `);
        selectedDbName = inputName || defaultName;

        console.log(`\n🚀 正在建立新資料庫 "${selectedDbName}"...`);
        const createRes = runWrangler(['d1', 'create', selectedDbName]);
        if (createRes.status !== 0) {
          console.error('❌ 資料庫建立失敗:', createRes.stderr || createRes.stdout);
          process.exit(1);
        }

        // 重新拉取以獲得新 DB 的 UUID
        const refreshedList = runWrangler(['d1', 'list', '--json']);
        const allDbs = parseD1ListJson(refreshedList.stdout);
        const found = allDbs.find(d => d.name === selectedDbName);
        if (found) {
          selectedDbId = found.uuid;
        } else {
          // 自輸出文字中提取 UUID
          const uuidMatch = createRes.stdout.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          selectedDbId = uuidMatch ? uuidMatch[1] : '';
        }
      }
    }

    if (!selectedDbId) {
      console.error('❌ 無法解析資料庫 UUID，請手動確認。');
      process.exit(1);
    }

    // 3. 自動更新 packages/backend/wrangler.toml
    console.log(`\n📝 正在更新 ${path.relative(ROOT_DIR, WRANGLER_TOML_PATH)}...`);
    const newToml = updateWranglerTomlDatabase(tomlContent, selectedDbName, selectedDbId);
    fs.writeFileSync(WRANGLER_TOML_PATH, newToml, 'utf8');
    console.log(`✅ 已自動綁定: database_name = "${selectedDbName}", database_id = "${selectedDbId}"`);

    // 4. 執行 schema.sql 建立資料表
    console.log(`\n📦 正在對 "${selectedDbName}" 執行 schema 建立資料表...`);
    if (fs.existsSync(SCHEMA_SQL_PATH)) {
      const execRes = runWrangler(['d1', 'execute', selectedDbName, '--remote', `--file=${SCHEMA_SQL_PATH}`]);
      if (execRes.status === 0) {
        console.log('✅ 基礎預約資料表 (service_requests, blocked_dates) 建立成功！');
      } else {
        console.warn('⚠️ 基礎表格執行提示 (可能表格已存在):', execRes.stderr || execRes.stdout);
      }
    }

    // 若存在 Ep03 時段管理 migration，一併執行
    if (fs.existsSync(EP03_MIGRATION_PATH)) {
      console.log('📦 檢測到 Ep03 時段排程 schema，正在同步套用...');
      const ep03Res = runWrangler(['d1', 'execute', selectedDbName, '--remote', `--file=${EP03_MIGRATION_PATH}`]);
      if (ep03Res.status === 0) {
        console.log('✅ Ep03 時段排程表格套用成功！');
      }
    }

    // 5. 執行關鍵防呆預檢 (Pre-flight Sanity Checks)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛡️  執行 LINE 與安全關鍵防呆檢核 (Pre-flight Sanity Checks)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const liffMatch = newToml.match(/LIFF_ID\s*=\s*"([^"]+)"/);
    const channelIdMatch = newToml.match(/LINE_LOGIN_CHANNEL_ID\s*=\s*"([^"]+)"/);
    const liffId = liffMatch ? liffMatch[1] : '';
    const channelId = channelIdMatch ? channelIdMatch[1] : '';

    const liffCheck = checkLiffIdConsistency(liffId, channelId);
    if (!liffCheck.valid) {
      console.log('\n🚨 【嚴重錯誤警告：LINE ID 錯位】');
      console.log(`   - LIFF_ID:                 ${liffId}`);
      console.log(`   - LIFF 前 10 碼 Channel ID: ${liffCheck.liffPrefix}`);
      console.log(`   - LINE_LOGIN_CHANNEL_ID:    ${liffCheck.channelId}`);
      console.log(`\n❌ 原因說明: ${liffCheck.error}`);
      console.log(`👉 解決方式: 請修改 packages/backend/wrangler.toml，將 LINE_LOGIN_CHANNEL_ID 改為 "${liffCheck.liffPrefix}"！\n`);
    } else {
      console.log('✅ [通過] LIFF_ID 前綴與 LINE_LOGIN_CHANNEL_ID 一致。');
    }

    // 檢查 Worker 名稱是否與其他既有 Worker 衝突
    console.log('🔎 正在檢查 Worker 名稱是否與現有線上服務站衝突...');
    const depCheck = runWrangler(['deployments', 'list', `--name=${workerName}`]);
    if (depCheck.status === 0 && depCheck.stdout.includes('Created:')) {
      console.log(`ℹ️  Worker "${workerName}" 目前已在 Cloudflare 運行。若您是在建立全新店家，請確保這是您要覆蓋更新的目標 Worker。`);
    } else {
      console.log(`✅ [通過] Worker 名稱 "${workerName}" 為全新部署。`);
    }

    // 檢查 Turnstile 密鑰狀態
    const secList = runWrangler(['secret', 'list', `--name=${workerName}`]);
    if (secList.status === 0 && secList.stdout.includes('TURNSTILE_SECRET_KEY')) {
      console.log('✅ [通過] TURNSTILE_SECRET_KEY 密鑰已就緒。');
    } else {
      console.log('⚠️  [提示] 尚未設定 TURNSTILE_SECRET_KEY，表單送單時可能受限。可執行 npm run setup:turnstile 一鍵建立。');
    }

    console.log('\n🎉 【D1 資料庫配置與防呆檢查完成！】');
    console.log(`   - 資料庫名稱: ${selectedDbName}`);
    console.log(`   - 資料庫 UUID: ${selectedDbId}`);
    console.log('   - 下一步: 執行 npm run deploy:backend 發布您的後端 API。\n');

  } finally {
    rl.close();
  }
}

// 模組匯出以利單元測試
module.exports = {
  parseD1ListJson,
  checkLiffIdConsistency,
  updateWranglerTomlDatabase
};

if (require.main === module) {
  main().catch(err => {
    console.error('執行過程發生未預期錯誤:', err);
    process.exit(1);
  });
}
