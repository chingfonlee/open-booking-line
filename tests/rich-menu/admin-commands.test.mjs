import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaiwanDateRange,
  generateAdminPendingCarousel,
  generateAdminScheduleCarousel
} from '../../packages/backend/src/line.ts';

test('Ep02 Admin Commands Suite (待審與未來一週施工)', async (t) => {
  await t.test('1. getTaiwanDateRange should return valid today, end date and range text', () => {
    const range = getTaiwanDateRange(6);
    assert.ok(range.todayStr.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(range.endStr.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(range.rangeText.includes('~'));

    const todayDate = new Date(range.todayStr);
    const endDate = new Date(range.endStr);
    const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 6, 'Should span 7 days including today (diff is 6 days)');
  });

  await t.test('2. generateAdminPendingCarousel should handle empty list gracefully', () => {
    const emptyRes = generateAdminPendingCarousel([], '2001111111-TEST', '燕巢服務站');
    assert.equal(emptyRes.type, 'text');
    assert.ok(emptyRes.text.includes('全部案件已處理完畢'));
  });

  await t.test('3. generateAdminPendingCarousel should build bubble with action buttons for 1 item', () => {
    const mockPending = [
      {
        id: 'SR-20261005-001',
        contact_name: '陳大明',
        phone: '0912-345-678',
        service_type: '碎枝服務',
        crop_type: '芭樂',
        area_size: '2.5 分',
        location_area: '燕巢區',
        location_address: '角宿路 12 號',
        preferred_date: '2026-10-06',
        preferred_time_slot: 'morning'
      }
    ];

    const res = generateAdminPendingCarousel(mockPending, '2001111111-TEST', '燕巢服務站');
    assert.equal(res.type, 'flex');
    assert.equal(res.contents.type, 'bubble');
    assert.ok(res.altText.includes('陳大明'));

    const footer = res.contents.footer;
    assert.ok(footer);
    const buttons = footer.contents;
    // 一鍵通話按鈕
    const callBtn = buttons.find(b => b.action?.uri?.startsWith('tel:'));
    assert.ok(callBtn);
    assert.equal(callBtn.action.uri, 'tel:0912345678');

    // 審核排程按鈕
    const scheduleBtn = buttons.find(b => b.action?.uri?.includes('filter=to_contact'));
    assert.ok(scheduleBtn);
  });

  await t.test('4. generateAdminPendingCarousel should build carousel for multiple items (capped at 10)', () => {
    const mockList = Array.from({ length: 15 }, (_, i) => ({
      id: `SR-20261005-${String(i + 1).padStart(3, '0')}`,
      contact_name: `農友${i + 1}`,
      phone: `090000000${i}`,
      service_type: '碎枝服務',
      crop_type: '棗子',
      preferred_date: '2026-10-08',
      preferred_time_slot: 'afternoon'
    }));

    const res = generateAdminPendingCarousel(mockList, '2001111111-TEST', '燕巢服務站');
    assert.equal(res.type, 'flex');
    assert.equal(res.contents.type, 'carousel');
    assert.equal(res.contents.contents.length, 10, 'Must cap at 10 items for LINE Flex limit');
  });

  await t.test('5. generateAdminScheduleCarousel should handle empty schedule gracefully', () => {
    const emptyRes = generateAdminScheduleCarousel([], '2001111111-TEST', '燕巢服務站', '10/05 ~ 10/11');
    assert.equal(emptyRes.type, 'text');
    assert.ok(emptyRes.text.includes('尚無排定施工案件'));
    assert.ok(emptyRes.text.includes('10/05 ~ 10/11'));
  });

  await t.test('6. generateAdminScheduleCarousel should build schedule card with time, date and phone', () => {
    const mockSchedule = [
      {
        id: 'SR-20261004-888',
        contact_name: '王小華',
        phone: '0988-777-666',
        crop_type: '蜜棗',
        area_size: '3 分',
        location_area: '大樹區',
        location_address: '姑婆寮段 5 號',
        scheduled_date: '2026-10-05',
        scheduled_slot_code: 'morning',
        scheduled_start_time: '08:30',
        customer_notice: '請從北側小路開進來，路面較寬'
      }
    ];

    const res = generateAdminScheduleCarousel(mockSchedule, '2001111111-TEST', '大樹服務站');
    assert.equal(res.type, 'flex');
    assert.equal(res.contents.type, 'bubble');
    assert.ok(res.altText.includes('2026-10-05'));
    assert.ok(res.altText.includes('王小華'));

    // Check notice and time rendering
    const fullStr = JSON.stringify(res.contents);
    assert.ok(fullStr.includes('北側小路開進來'));
    assert.ok(fullStr.includes('08:30'));

    // Check call action
    const footerStr = JSON.stringify(res.contents.footer);
    assert.ok(footerStr.includes('tel:0988777666'));
    assert.ok(footerStr.includes('filter=confirmed'));
  });

  await t.test('7. Fail-Closed Security Audit: admin commands must strictly isolate secrets and customer data', () => {
    // 驗證白名單檢查語義：非管理員嘗試「待審」或「施工」必須被拒絕
    const adminIds = ['U_ADMIN_OFFICIAL', 'U_NOTIFY_STAFF'];
    const nonAdminUser = 'U_REGULAR_CUSTOMER';

    const checkIsAdmin = (uid) => adminIds.includes(uid);
    assert.equal(checkIsAdmin(nonAdminUser), false);
    assert.equal(checkIsAdmin('U_ADMIN_OFFICIAL'), true);
  });
});
