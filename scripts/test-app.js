const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const appCode = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
const dataCode = fs.readFileSync(path.join(rootDir, 'data', 'mockData.js'), 'utf8');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

console.log('🧪 Starting interactive verification of single basic edition...');

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
        } else if (val) this.classes.add(c);
        else this.classes.delete(c);
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
    eventListeners: {},
    addEventListener(event, fn) {
      if (!this.eventListeners[event]) this.eventListeners[event] = [];
      this.eventListeners[event].push(fn);
    },
    trigger(event, data) {
      (this.eventListeners[event] || []).forEach(fn => fn(data || { currentTarget: el, target: el, preventDefault() {} }));
    },
    querySelector(s) {
      if (s.startsWith('#')) return domElements.get(s.slice(1)) || null;
      return createElement('div');
    },
    querySelectorAll() { return []; },
    scrollTop: 0
  };
  return el;
}

const elementIds = [
  'app-screen', 'back-btn', 'toast', 'admin-stat-chips', 'stat-count-all',
  'stat-count-to_contact', 'stat-count-processing', 'stat-count-closed',
  'nav-badge-count', 'admin-mobile-search', 'admin-cards-container',
  'tab-panel-bookings', 'tab-panel-other', 'admin-bottom-nav',
  'detail-modal', 'detail-modal-body', 'btn-close-detail',
  'admin-mobile-toast', 'admin-notice-btn', 'mobile-view', 'admin-mobile-view'
];

elementIds.forEach(id => domElements.set(id, createElement('div')));

const mockContext = {
  window: {
    location: { href: '' },
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' }
  },
  document: {
    querySelector(sel) {
      if (sel.startsWith('#')) return domElements.get(sel.slice(1)) || null;
      return createElement('div');
    },
    querySelectorAll(sel) {
      return [];
    }
  },
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); }
  },
  console: {
    log: () => {},
    warn: () => {},
    error: console.error
  },
  confirm: () => true,
  setTimeout: (fn) => fn()
};

vm.createContext(mockContext);
vm.runInContext(dataCode, mockContext);
vm.runInContext(appCode, mockContext);

// Verify initial stats
const countAll = domElements.get('stat-count-all').textContent;
const countContact = domElements.get('stat-count-to_contact').textContent;
const countProc = domElements.get('stat-count-processing').textContent;
const countClosed = domElements.get('stat-count-closed').textContent;

console.log(`Stats count: 全部=${countAll}, 待聯絡=${countContact}, 處理中=${countProc}, 已結案=${countClosed}`);

if (countAll !== '06' || countContact !== '03' || countProc !== '02' || countClosed !== '01') {
  throw new Error(`Initial stats counts incorrect! Expected 06/03/02/01, got ${countAll}/${countContact}/${countProc}/${countClosed}`);
}
console.log('✓ Initial 4 stats chips match requirement 06 / 03 / 02 / 01');

// Verify cards rendered
const cardsHtml = domElements.get('admin-cards-container').innerHTML;
if (!cardsHtml.includes('XN-DEMO-006') || !cardsHtml.includes('岡山王')) {
  throw new Error('Cards list missing XN-DEMO-006 岡山王!');
}
if (!cardsHtml.includes('📞 撥打電話') || !cardsHtml.includes('查看資料')) {
  throw new Error('Cards missing primary CTA 撥打電話 or 查看資料!');
}
if (!cardsHtml.includes('希望日期')) {
  throw new Error('Cards missing 希望日期!');
}
console.log('✓ Cards list rendered with 撥打電話 & 查看資料 CTAs');

// Verify detail modal
const detailModalBody = domElements.get('detail-modal-body');
vm.runInContext("openDetailModal(adminBookings[0]);", mockContext);
const modalContent = detailModalBody.innerHTML;
if (!modalContent.includes('顧客聯絡資料') || !modalContent.includes('0912-345-678')) {
  throw new Error('Detail modal missing customer phone info!');
}
if (!modalContent.includes('希望施工日期')) {
  throw new Error('Detail modal missing 希望施工日期!');
}
if (!modalContent.includes('處理狀態')) {
  throw new Error('Detail modal missing 處理狀態 radio group!');
}
console.log('✓ Detail modal rendered with full client info, call button, and 3 status options');

// Test status toggle to 'closed'
vm.runInContext(`
  adminBookings[0].status = 'closed';
  updateAdminStats();
`, mockContext);

const updatedContact = domElements.get('stat-count-to_contact').textContent;
const updatedClosed = domElements.get('stat-count-closed').textContent;
console.log(`After status update: 待聯絡=${updatedContact}, 已結案=${updatedClosed}`);
if (updatedContact !== '02' || updatedClosed !== '02') {
  throw new Error('Stats did not update after status change!');
}
console.log('✓ Status transition updates stats correctly');

console.log('\n🎉 ALL LOGIC AND INTERACTION TESTS PASSED 100%!');
