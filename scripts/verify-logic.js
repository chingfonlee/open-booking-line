const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');

function testTier(tierName) {
  console.log(`\n🔍 Verifying tier: ${tierName}...`);
  const tierDir = path.join(rootDir, 'dist', tierName);
  
  const plansCode = fs.readFileSync(path.join(tierDir, 'config', 'plans.js'), 'utf8');
  const dataCode = fs.readFileSync(path.join(tierDir, 'data', 'mockData.js'), 'utf8');
  const appCode = fs.readFileSync(path.join(tierDir, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(tierDir, 'index.html'), 'utf8');

  // Verify HTML title and script injection
  if (!html.includes(`window.__PLAN__ = '${tierName}'`)) {
    throw new Error(`index.html does not inject window.__PLAN__ = '${tierName}'`);
  }

  // Create a mock DOM context
  const domElements = new Map();
  function createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        toggle(c, val) {
          if (val === undefined) {
            if (this.classes.has(c)) this.classes.delete(c);
            else this.classes.add(c);
          } else if (val) {
            this.classes.add(c);
          } else {
            this.classes.delete(c);
          }
        },
        contains(c) { return this.classes.has(c); }
      },
      style: {},
      dataset: {},
      children: [],
      innerHTML: '',
      textContent: '',
      hidden: false,
      value: '',
      addEventListener() {},
      querySelector(s) {
        if (s.startsWith('#')) return domElements.get(s.slice(1)) || null;
        return createElement('div');
      },
      querySelectorAll() { return []; },
      scrollTop: 0
    };
    return el;
  }

  const ids = [
    'app-screen', 'back-btn', 'toast', 'plan-badge-container', 'admin-plan-bar',
    'admin-plan-eyebrow', 'admin-stage-title', 'admin-stage-desc', 'admin-header-subtitle',
    'comparison-modal', 'btn-open-compare', 'btn-close-compare', 'admin-mobile-toast',
    'admin-stat-chips', 'admin-cards-container', 'admin-bottom-nav', 'tab-panel-bookings',
    'tab-panel-other', 'schedule-modal', 'dispatch-specific-fields', 'modal-sched-title',
    'sched-submit-btn', 'sched-booking-id', 'sched-modal-id', 'sched-modal-farmer',
    'sched-modal-place', 'sched-modal-hope-date', 'sched-actual-date', 'sched-worker-select',
    'sched-machine-select', 'sched-note', 'btn-close-sched-modal', 'btn-cancel-sched',
    'sched-confirm-form', 'admin-mobile-search', 'mobile-add-btn', 'admin-notice-btn'
  ];

  ids.forEach(id => {
    domElements.set(id, createElement('div'));
  });

  const mockContext = {
    window: {
      __PLAN__: tierName,
      location: { href: '' }
    },
    document: {
      querySelector(selector) {
        if (selector.startsWith('#')) {
          return domElements.get(selector.slice(1)) || null;
        }
        return createElement('div');
      },
      querySelectorAll() {
        return [];
      }
    },
    localStorage: {
      getItem() { return null; },
      setItem() {}
    },
    console: {
      log: () => {},
      warn: () => {},
      error: console.error
    },
    setTimeout: (fn) => fn(),
    confirm: () => true
  };

  vm.createContext(mockContext);
  vm.runInContext(plansCode, mockContext);
  vm.runInContext(dataCode, mockContext);
  vm.runInContext(appCode, mockContext);

  // Check generated plan badge HTML
  const badge = domElements.get('plan-badge-container').innerHTML;
  console.log(`  ✓ Badge HTML: ${badge.replace(/\s+/g, ' ').trim()}`);

  // Check stat chips
  const statChipsHtml = domElements.get('admin-stat-chips').innerHTML;
  if (tierName === 'starter') {
    if (statChipsHtml.includes('已排程')) throw new Error('Starter has 已排程 chip!');
    if (!statChipsHtml.includes('待聯絡')) throw new Error('Starter missing 待聯絡 chip!');
  } else {
    if (!statChipsHtml.includes('已排程')) throw new Error(`${tierName} missing 已排程 chip!`);
  }
  console.log(`  ✓ Stat Chips correctly formatted for ${tierName}`);

  // Check bottom nav
  const bottomNavHtml = domElements.get('admin-bottom-nav').innerHTML;
  if (tierName === 'starter') {
    if (bottomNavHtml.includes('派工日程') || bottomNavHtml.includes('農友名錄')) {
      throw new Error('Starter has dispatch or farmers tab!');
    }
  } else if (tierName === 'management') {
    if (!bottomNavHtml.includes('施工日程') || !bottomNavHtml.includes('農友名錄')) {
      throw new Error('Management missing 施工日程 or 農友名錄!');
    }
    if (bottomNavHtml.includes('師傅與機具')) {
      throw new Error('Management has 師傅與機具 tab!');
    }
  } else if (tierName === 'dispatch') {
    if (!bottomNavHtml.includes('派工日程') || !bottomNavHtml.includes('師傅與機具')) {
      throw new Error('Dispatch missing 派工日程 or 師傅與機具!');
    }
  }
  console.log(`  ✓ Bottom Nav tabs strictly aligned for ${tierName}`);
  console.log(`  ✅ ${tierName} passed all headless VM tests!`);
}

['starter', 'management', 'dispatch'].forEach(testTier);
console.log('\n🎉 ALL 3 TIERS VERIFIED SUCCESSFULLY IN VM ENVIRONMENT!');
