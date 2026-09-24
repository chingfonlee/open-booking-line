const { chromium } = require('playwright');

async function testPlans() {
  console.log('🚀 Launching headless browser to verify 3 tiers...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Browser Error:', msg.text());
      errors.push(msg.text());
    }
  });

  // 1. Test Starter
  console.log('Testing Starter tier (http://localhost:4173/dist/starter/)...');
  await page.goto('http://localhost:4173/dist/starter/');
  let title = await page.title();
  console.log('Title:', title);
  let badgeText = await page.locator('.plan-tier-badge.starter').first().innerText();
  console.log('Starter Badge:', badgeText);
  if (!badgeText.includes('接單版')) throw new Error('Starter badge missing or incorrect');

  // Switch to admin mobile view
  await page.click('button[data-view="admin-mobile"]');
  let statChips = await page.locator('.stat-chip').allInnerTexts();
  console.log('Starter Stat Chips:', statChips.map(s => s.replace('\n', ' ')));
  // Check no scheduled chip
  if (statChips.some(s => s.includes('已排程'))) throw new Error('Starter should NOT have 已排程 chip');

  // Check bottom tabs
  let bottomTabs = await page.locator('.bottom-tab .tab-label').allInnerTexts();
  console.log('Starter Bottom Tabs:', bottomTabs);
  if (bottomTabs.includes('派工日程') || bottomTabs.includes('農友名錄') || bottomTabs.includes('師傅與機具')) {
    throw new Error('Starter should NOT have dispatch/resource/farmers tabs');
  }

  // 2. Test Management
  console.log('\nTesting Management tier (http://localhost:4173/dist/management/)...');
  await page.goto('http://localhost:4173/dist/management/');
  badgeText = await page.locator('.plan-tier-badge.management').first().innerText();
  console.log('Management Badge:', badgeText);
  if (!badgeText.includes('管理版')) throw new Error('Management badge missing');

  await page.click('button[data-view="admin-mobile"]');
  statChips = await page.locator('.stat-chip').allInnerTexts();
  console.log('Management Stat Chips:', statChips.map(s => s.replace('\n', ' ')));
  if (!statChips.some(s => s.includes('已排程'))) throw new Error('Management should have 已排程 chip');

  bottomTabs = await page.locator('.bottom-tab .tab-label').allInnerTexts();
  console.log('Management Bottom Tabs:', bottomTabs);
  if (!bottomTabs.includes('施工日程') || !bottomTabs.includes('農友名錄')) {
    throw new Error('Management must have 施工日程 and 農友名錄');
  }
  if (bottomTabs.includes('師傅與機具')) {
    throw new Error('Management should NOT have 師傅與機具 tab');
  }

  // Click 施工日程 tab
  await page.click('.bottom-tab[data-tab="schedule_simple"]');
  let panelTitle = await page.locator('.panel-section-title').innerText();
  console.log('Management Schedule Panel:', panelTitle);

  // 3. Test Dispatch
  console.log('\nTesting Dispatch tier (http://localhost:4173/dist/dispatch/)...');
  await page.goto('http://localhost:4173/dist/dispatch/');
  badgeText = await page.locator('.plan-tier-badge.dispatch').first().innerText();
  console.log('Dispatch Badge:', badgeText);
  if (!badgeText.includes('派工版')) throw new Error('Dispatch badge missing');

  await page.click('button[data-view="admin-mobile"]');
  bottomTabs = await page.locator('.bottom-tab .tab-label').allInnerTexts();
  console.log('Dispatch Bottom Tabs:', bottomTabs);
  if (!bottomTabs.includes('派工日程') || !bottomTabs.includes('師傅與機具') || !bottomTabs.includes('農友名錄')) {
    throw new Error('Dispatch must have 派工日程, 師傅與機具, 農友名錄');
  }

  // Click 師傅與機具
  await page.click('.bottom-tab[data-tab="resources"]');
  let resourceTitle = await page.locator('.panel-section-title').innerText();
  console.log('Dispatch Resource Panel:', resourceTitle);

  // Test Comparison Modal
  console.log('\nTesting Comparison Modal...');
  await page.click('#btn-open-compare');
  let isModalVisible = await page.locator('#comparison-modal').isVisible();
  console.log('Comparison Modal visible:', isModalVisible);
  if (!isModalVisible) throw new Error('Comparison modal failed to open');

  await page.click('#btn-close-compare');
  let isModalClosed = await page.locator('#comparison-modal').isHidden();
  console.log('Comparison Modal closed:', isModalClosed);

  await browser.close();

  if (errors.length > 0) {
    console.error('Found browser errors:', errors);
    process.exit(1);
  }
  console.log('\n🎉 ALL 3 TIERS PASSED VERIFICATION WITH ZERO ERRORS!');
}

testPlans().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
