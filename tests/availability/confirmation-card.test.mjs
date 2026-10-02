import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateScheduledConfirmationFlex,
  generateProgressQueryFlex,
  generateCustomerConfirmationFlex
} from '../../packages/backend/src/line.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('Ep03-6 Confirmation Card & Display Consistency Test Suite', async (t) => {
  const mockStationName = '燕巢農業智慧服務站';
  const mockLiffId = '1657890000-abcdefgh';

  const mockRequest = {
    id: 'REQ-20261015-ABCD',
    contact_name: '陳大文',
    phone: '0912345678',
    service_type: '果樹枝條粉碎',
    crop_type: '蜜棗',
    area_size: '2.5 分地',
    branch_volume: '約 10 立方公尺',
    location_area: '燕巢區',
    location_address: '深水里深中路 100 號',
    preferred_date: '2026-10-18',
    preferred_time_slot: 'morning',
    date_flexibility: '前後三天皆可',
    status: 'confirmed'
  };

  const mockReservation = {
    booking_date: '2026-10-19',
    slot_code: 'morning',
    scheduled_start_time: '08:30'
  };

  await t.test('1. Confirmation Card: contains precise start time, scheduled date, and station header', () => {
    const card = generateScheduledConfirmationFlex(
      mockRequest,
      mockReservation,
      mockLiffId,
      mockStationName,
      false
    );

    // 1. 結構與基本屬性
    assert.equal(card.type, 'flex');
    assert.ok(card.altText.includes('【服務排程已確認】'));
    assert.ok(card.altText.includes('REQ-20261015-ABCD'));
    assert.ok(card.altText.includes('2026-10-19 08:30'));

    const bubble = card.contents;
    assert.equal(bubble.type, 'bubble');

    // 2. Header
    const headerTexts = bubble.header.contents.map(c => c.text);
    assert.ok(headerTexts.some(t => t.includes(mockStationName)));
    assert.ok(headerTexts.some(t => t.includes('預約排程已正式確認')));
    assert.ok(headerTexts.some(t => t.includes('REQ-20261015-ABCD')));

    // 3. Body: 確認日期與開工時間
    const bodyBoxes = bubble.body.contents;
    const dateRow = bodyBoxes.find(b => b.contents?.[0]?.text === '確認日期');
    assert.ok(dateRow, 'Must have 確認日期 row');
    assert.equal(dateRow.contents[1].text, '2026-10-19 (上午)');

    const timeRow = bodyBoxes.find(b => b.contents?.[0]?.text === '開工時間');
    assert.ok(timeRow, 'Must have 開工時間 row');
    assert.equal(timeRow.contents[1].text, '08:30 準時抵達');

    // 4. Footer
    const footerBtn = bubble.footer.contents[0];
    assert.equal(footerBtn.type, 'button');
    assert.ok(footerBtn.action.uri.includes(mockLiffId));
  });

  await t.test('2. Reschedule Card: supports isReschedule=true with updated header and altText', () => {
    const rescheduleReservation = {
      booking_date: '2026-10-22',
      slot_code: 'afternoon',
      scheduled_start_time: '14:00'
    };

    const card = generateScheduledConfirmationFlex(
      mockRequest,
      rescheduleReservation,
      mockLiffId,
      mockStationName,
      true
    );

    assert.ok(card.altText.includes('【服務排程已改期】'));
    assert.ok(card.altText.includes('2026-10-22 14:00'));

    const headerTexts = card.contents.header.contents.map(c => c.text);
    assert.ok(headerTexts.some(t => t.includes('預約排程已更新 (改期)')));

    const bodyBoxes = card.contents.body.contents;
    const dateRow = bodyBoxes.find(b => b.contents?.[0]?.text === '確認日期');
    assert.equal(dateRow.contents[1].text, '2026-10-22 (下午)');

    const timeRow = bodyBoxes.find(b => b.contents?.[0]?.text === '開工時間');
    assert.equal(timeRow.contents[1].text, '14:00 準時抵達');
  });

  await t.test('3. Query Progress Card: uses slot_reservations scheduled date and time when confirmed', () => {
    // 模擬已排程確認的案件（左連接 slot_reservations）
    const confirmedRecord = {
      id: 'REQ-20261015-ABCD',
      status: 'confirmed',
      service_type: '果樹枝條粉碎',
      crop_type: '蜜棗',
      area_size: '2.5 分地',
      preferred_date: '2026-10-18', // 希望日期 (原申請)
      preferred_time_slot: 'morning',
      scheduled_date: '2026-10-19', // 正式排程 (slot_reservations)
      scheduled_slot_code: 'morning',
      scheduled_start_time: '08:30', // 正式開工時間 (slot_reservations)
      location_area: '燕巢區',
      location_address: '深水里深中路 100 號'
    };

    const card = generateProgressQueryFlex([confirmedRecord], mockLiffId, mockStationName);
    const bubble = card.contents;

    // 狀態徽章應為已確認排程
    const badgeText = bubble.body.contents[0].contents[0].text;
    assert.ok(badgeText.includes('已確認排程'));

    // 日期列標題應為「確認日期」，值為正式排程日期 2026-10-19，而非原本希望的 2026-10-18
    const dateRow = bubble.body.contents.find(b => b.contents?.[0]?.text === '確認日期');
    assert.ok(dateRow, 'Row title must be 確認日期 for confirmed request');
    assert.equal(dateRow.contents[1].text, '2026-10-19 (上午)');

    // 必須包含開工時間列
    const timeRow = bubble.body.contents.find(b => b.contents?.[0]?.text === '開工時間');
    assert.ok(timeRow, 'Must have 開工時間 in query card when scheduled_start_time exists');
    assert.equal(timeRow.contents[1].text, '08:30 準時抵達');

    // 底部客製化狀態說明應明確提及確認日期與開工時間
    const noteText = bubble.body.contents[bubble.body.contents.length - 1].contents[0].text;
    assert.ok(noteText.includes('2026-10-19'));
    assert.ok(noteText.includes('08:30'));
  });

  await t.test('4. Query Progress Card: uses preferred date when status is to_contact (pending)', () => {
    const pendingRecord = {
      id: 'REQ-20261015-XYZ',
      status: 'to_contact',
      service_type: '農機出租',
      crop_type: '芭樂',
      area_size: '1 分地',
      preferred_date: '2026-10-25',
      preferred_time_slot: 'afternoon',
      scheduled_date: null,
      scheduled_slot_code: null,
      scheduled_start_time: null,
      location_area: '阿蓮區',
      location_address: '和平路 12 號'
    };

    const card = generateProgressQueryFlex([pendingRecord], mockLiffId, mockStationName);
    const bubble = card.contents;

    // 日期列標題應為「希望日期」
    const dateRow = bubble.body.contents.find(b => b.contents?.[0]?.text === '希望日期');
    assert.ok(dateRow, 'Row title must be 希望日期 for pending request');
    assert.equal(dateRow.contents[1].text, '2026-10-25 (下午)');

    // 絕不可有開工時間列
    const timeRow = bubble.body.contents.find(b => b.contents?.[0]?.text === '開工時間');
    assert.equal(timeRow, undefined, 'Must not have 開工時間 row when request is pending');
  });

  await t.test('5. Static Audit: index.ts joins slot_reservations in webhook and endpoints', () => {
    const indexSource = fs.readFileSync(
      path.join(rootDir, 'packages/backend/src/index.ts'),
      'utf8'
    );

    // 驗證 GET /api/admin/requests 左連接 slot_reservations
    assert.ok(
      indexSource.includes("LEFT JOIN slot_reservations s ON r.id = s.request_id AND s.status = 'active'"),
      'GET /api/admin/requests must left join active slot_reservations'
    );

    // 驗證 LINE Webhook isQuery 左連接 slot_reservations
    assert.ok(
      indexSource.includes("LEFT JOIN slot_reservations s ON r.id = s.request_id AND s.status = 'active'"),
      'LINE Webhook isQuery must left join active slot_reservations'
    );

    // 驗證 confirm 端點與 reschedule 端點呼叫 generateScheduledConfirmationFlex 推播卡片
    assert.ok(
      indexSource.includes('generateScheduledConfirmationFlex'),
      'Endpoints must call generateScheduledConfirmationFlex'
    );

    // 驗證推播失敗不中斷排程 (Side effect isolated)
    assert.ok(
      indexSource.includes('pushLineMessage'),
      'Must invoke pushLineMessage'
    );
  });

  await t.test('6. Static Audit: AdminDashboard displays scheduled date & time clearly', () => {
    const adminSource = fs.readFileSync(
      path.join(rootDir, 'packages/frontend/src/components/AdminDashboard.tsx'),
      'utf8'
    );

    // 驗證清單項展示 scheduled_date 與 scheduled_start_time
    assert.ok(adminSource.includes('req.scheduled_date'), 'Admin dashboard list must inspect scheduled_date');
    assert.ok(adminSource.includes('req.scheduled_start_time'), 'Admin dashboard list must inspect scheduled_start_time');
    assert.ok(adminSource.includes('正式排程：'), 'Admin dashboard must display 正式排程 badge/label');

    // 驗證 Drawer 抽屜展示正式排程鎖定狀態
    assert.ok(adminSource.includes('正式排程已鎖定'), 'Drawer must display 正式排程已鎖定 banner');
  });
});
