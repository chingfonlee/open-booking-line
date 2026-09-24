// 行農合作社｜服務申請管理 前端核心邏輯 (單一基礎版)

// 1. 資料初始化與存儲
const STORAGE_KEY = 'xingnong_service_requests_v3';

const statusConfig = {
  to_contact: { key: 'to_contact', label: '待聯絡', pillText: '🟡 待聯絡' },
  processing: { key: 'processing', label: '處理中', pillText: '🔵 處理中' },
  closed: { key: 'closed', label: '已結案', pillText: '⚪ 已結案' }
};

function initBookings() {
  const seed = (typeof MOCK_DATA !== 'undefined' && MOCK_DATA.bookings) ? MOCK_DATA.bookings : [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
  }

  // 標準化為單一基礎版的 3 個狀態：待聯絡(03)、處理中(02)、已結案(01)
  return seed.map(item => ({
    id: item.id,
    name: item.name,
    phone: item.phone,
    service: item.service || '果樹枝條粉碎',
    crop: item.crop || '芭樂',
    area: item.area || '燕巢',
    location: item.location || '',
    size: item.size || '3 分',
    branches: item.branches || '中量',
    hopeDate: item.hopeDate || item.date || '2026-09-29',
    flex: item.flex || '前後 3 天皆可',
    note: item.note || '',
    time: item.time || '剛剛送出',
    createdAt: '2026-09-21 17:20',
    status: item.starterStatus || 'to_contact',
    lineFriend: true
  }));
}

let adminBookings = initBookings();
let latestCustomerBookingId = adminBookings[0]?.id || 'XN-DEMO-006';
let currentAdminFilter = 'all';
let currentAdminSearch = '';
let currentAdminTab = 'bookings';

function saveBookings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(adminBookings));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

function getStatusInfo(statusKey) {
  return statusConfig[statusKey] || statusConfig.to_contact;
}

// 撥電話處理 (手機上直接觸發 tel:，電腦桌面顯示友善提示)
function triggerPhoneCall(name, phone) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `tel:${phone}`;
  } else {
    const choice = confirm(`撥打電話給 ${name} (${phone})：\n\n【確定】模擬開啟外撥功能 (tel:${phone})\n【取消】複製電話號碼`);
    if (choice) {
      window.location.href = `tel:${phone}`;
      showAdminToast(`📞 正撥打電話至 ${phone}`);
    } else {
      navigator.clipboard?.writeText(phone);
      showAdminToast(`已複製電話號碼：${phone}`);
    }
  }
}

// ==========================================
// 2. 顧客端 LINE 官方帳號流程
// ==========================================
const screen = document.querySelector('#app-screen');
const backBtn = document.querySelector('#back-btn');
const toast = document.querySelector('#toast');
let route = 'welcome';
let historyStack = [];
let formData = {};

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

const richMenu = () => `
  <div class="rich-menu">
    <button data-go="services">申請服務</button>
    <button data-go="my-booking">我的申請</button>
    <button data-toast="服務項目已包含於申請入口中">服務項目</button>
    <button data-toast="電話：07-616-XXXX｜上班時間主動致電">聯絡合作社</button>
  </div>
`;

const templates = {
  welcome: () => `
    <div class="demo-tag">DEMO／雙端資料即時連動</div>
    <div class="bubble">
      <div class="hero-leaf">🌱</div>
      <h2>歡迎來到行農合作社</h2>
      <p>請選擇您需要的農業服務。送出的申請將立即同步至右側合作社管理端！</p>
    </div>
    <button class="primary" data-go="services">開始填寫服務申請</button>
    <div class="quick-actions">
      <button data-go="services">① 果樹枝條粉碎</button>
      <button data-toast="此服務將於後續開放申請。">② 竹子粉碎</button>
      <button data-toast="此服務將於後續開放申請。">③ 果樹代耕</button>
      <button data-toast="此服務將於後續開放申請。">④ 農用設備出租</button>
    </div>
    ${richMenu()}
  `,

  services: () => `
    <div class="demo-tag">DEMO／填寫需求</div>
    <h2 class="page-title">請選擇服務項目</h2>
    <div class="service-list">
      <button class="service-btn available" data-go="crops">
        <span><strong>果樹枝條粉碎</strong><small>現場粉碎還田作業</small></span><b>›</b>
      </button>
      ${['竹子粉碎','果樹代耕','農用設備出租'].map(x => `
        <button class="service-btn" data-toast="Demo 尚未開放此項目">
          <span><strong>${x}</strong><small>後續開放</small></span><b>›</b>
        </button>
      `).join('')}
    </div>
    ${richMenu()}
  `,

  crops: () => `
    <div class="bubble soft">
      <h3>請選擇主要作物</h3>
      <p>這能幫助合作社先了解枝條粗細與進場作業方式。</p>
    </div>
    <div class="choice-grid">
      <button class="choice-btn" data-go="ready"><strong>🍐 芭樂</strong><b>›</b></button>
      <button class="choice-btn" data-toast="Demo 請優先選擇芭樂"><strong>🥭 棗子</strong><b>›</b></button>
      <button class="choice-btn" data-toast="Demo 請優先選擇芭樂"><strong>🎋 竹子</strong><b>›</b></button>
      <button class="choice-btn" data-toast="Demo 請優先選擇芭樂"><strong>🌳 其他</strong><b>›</b></button>
    </div>
    ${richMenu()}
  `,

  ready: () => `
    <div class="bubble">
      <p>您選擇的是：</p>
      <h3>果樹枝條粉碎</h3>
      <p>作物：<strong>芭樂</strong></p>
    </div>
    <div class="bubble soft">
      <p>接下來請填寫施工資訊與聯絡電話。</p>
      <small>合作社收到後會主動致電與您確認現場狀況。</small>
    </div>
    <button class="primary" data-go="form">填寫申請資料</button>
    ${richMenu()}
  `,

  'my-booking': () => {
    const b = adminBookings.find(x => x.id === latestCustomerBookingId) || adminBookings[0];
    const st = getStatusInfo(b.status);

    return `
      <h2 class="page-title">我的服務申請</h2>
      <div class="status-card">
        <strong style="color:var(--green-900)">${b.id}</strong>
        <p><strong>${b.service} · ${b.crop}</strong></p>
        <p>📍 ${b.area} · ${b.size}（${b.location}）</p>
        <p>📅 希望施工日期：${b.hopeDate} <small style="color:var(--muted)">(${b.flex})</small></p>
        <p>🌿 枝條數量：${b.branches}</p>

        <div style="margin:10px 0;padding:10px 12px;background:#fef9e8;border-radius:10px;font-size:13px;color:#856200;border:1px solid #fde68a">
          📞 <strong>合作社處理進度：</strong><br>
          合作社已收到您的申請，將於上班時間直接以電話與您聯繫確認。
        </div>

        <p>👤 聯絡人：${b.name} (${b.phone})</p>
        <div style="margin:10px 0">
          <em class="status-pill ${st.key}">${st.pillText}</em>
        </div>

        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
          <button class="primary" data-go="services">＋ 提出另一筆服務申請</button>
          <button class="secondary" data-go="welcome">返回首頁</button>
        </div>
      </div>
      ${richMenu()}
    `;
  },

  form: () => formTemplate(),
  review: () => reviewTemplate(),
  success: () => {
    const b = adminBookings.find(x => x.id === latestCustomerBookingId) || adminBookings[0];
    const st = getStatusInfo(b.status);
    return `
      <div class="form-shell">
        <div class="success-mark">✅</div>
        <h2>服務申請已收到</h2>
        <div class="success-copy" style="margin:12px 0;line-height:1.8">
          <p>行農合作社會查看您提供的資料。</p>
          <p>如需要確認現場狀況、估價或施工安排，我們會透過電話或 LINE 與您聯絡。</p>
          <p style="color:var(--muted);font-size:13px">實際價格與施工日期仍需由合作社電話確認。</p>
        </div>
        <div class="status-card" style="margin:14px 0;background:#faf8f3">
          <span>申請單號</span>
          <strong style="color:var(--green-700)">${b.id}</strong>
          <p style="margin:6px 0 2px"><strong>${b.name} · ${b.crop} (${b.area})</strong></p>
          <p style="margin:2px 0 8px;font-size:14px;color:var(--muted)">${b.location} · ${b.size}</p>
          <em class="status-pill ${st.key}">${st.pillText}</em>
        </div>
        <button class="primary" data-go="my-booking" style="margin-top:12px">查看我的申請狀態</button>
        <button class="secondary" style="margin-top:8px" data-go="welcome">返回首頁</button>
      </div>
    `;
  }
};

function formTemplate() {
  return `
    <div class="form-shell">
      <div class="progress"><span style="width:62%"></span></div>
      <div class="form-head">
        <small>🌱 行農合作社</small>
        <h2>果樹枝條粉碎申請</h2>
        <p>請一次填寫完整資訊，送出後合作社會主動致電確認。</p>
      </div>

      <!-- 核心聯絡管道提醒 -->
      <div style="background:#f5faf2;border:1px solid #c2e2c5;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:13px;line-height:1.6">
        <div>💬 <strong>LINE 官方好友：</strong>為方便後續估價與聯絡，請保持加入行農合作社官方好友。</div>
        <div style="margin-top:4px">📱 <strong>聯絡電話：</strong>請留下可通話的手機，合作社將直接致電確認現場狀況。</div>
      </div>

      <form id="booking-form" novalidate>
        <p style="font-size:14px;color:var(--green-900);margin:0 0 12px"><strong>申請項目：</strong>果樹枝條粉碎</p>
        
        <div class="field">
          <label for="crop">作物種類 <span class="req">必填</span></label>
          <select id="crop" name="crop" required>
            <option value="芭樂" selected>芭樂</option>
            <option>棗子</option>
            <option>竹子</option>
            <option>其他</option>
          </select>
        </div>

        <div class="field">
          <label for="area">施工區域 <span class="req">必填</span></label>
          <select id="area" name="area" required>
            <option value="">請選擇區域</option>
            <option>燕巢</option>
            <option>大社</option>
            <option>岡山</option>
            <option>大樹</option>
            <option>其他</option>
          </select>
        </div>

        <div class="field">
          <label for="location">詳細農地位置 <span class="req">必填</span></label>
          <input id="location" name="location" required placeholder="例如：燕巢區○○路旁、明顯地標或果菜市場周邊" value="${formData.location || ''}">
        </div>

        <div class="field">
          <label>農地面積 <span class="req">必填</span></label>
          <div class="inline-fields">
            <input type="number" name="size" min="0.1" step="0.1" required placeholder="例如：3" value="${formData.size || '3'}">
            <select name="unit">
              <option selected>分</option>
              <option>甲</option>
            </select>
          </div>
        </div>

        <fieldset class="field">
          <legend>枝條數量 <span class="req">必填</span></legend>
          <div class="radio-list">
            ${['少量','中量','大量','不確定'].map((x,i) => `
              <label><input type="radio" name="branches" value="${x}" ${i === 1 ? 'checked' : ''}>${x}</label>
            `).join('')}
          </div>
        </fieldset>

        <div class="field">
          <label for="date">希望施工日期 <span class="req">必填</span></label>
          <input id="date" name="date" type="date" required value="${formData.date || '2026-10-02'}">
        </div>
        <p class="form-note">實際施工日期仍需由合作社致電確認。</p>

        <fieldset class="field">
          <legend>日期彈性 <span class="optional">選填</span></legend>
          <div class="radio-list">
            ${['僅此日期方便','前後 3 天皆可','日期可以再與我聯絡確認'].map((x,i) => `
              <label><input type="radio" name="flex" value="${x}" ${i === 1 ? 'checked' : ''}>${x}</label>
            `).join('')}
          </div>
        </fieldset>

        <div class="field">
          <label for="contact">聯絡人姓名 <span class="req">必填</span></label>
          <input id="contact" name="contact" required placeholder="例如：林老伯" value="${formData.contact || ''}">
        </div>

        <div class="field">
          <label for="phone">聯絡手機號碼 <span class="req">必填</span></label>
          <input id="phone" name="phone" inputmode="tel" required pattern="[0-9\\x2D ]{8,}" placeholder="例如：0912-345-678" value="${formData.phone || ''}">
        </div>

        <div class="field">
          <label for="note">補充備註 <span class="optional">選填</span></label>
          <textarea id="note" name="note" placeholder="例如：農地入口較窄、需先電話聯絡引導等。">${formData.note || ''}</textarea>
        </div>

        <div id="form-error" class="error" hidden>請填寫紅色必填欄位後再繼續。</div>
        <button class="primary" type="submit">下一步：確認資料</button>
      </form>
    </div>
  `;
}

function reviewTemplate() {
  const f = formData;
  return `
    <div class="form-shell">
      <div class="progress"><span style="width:100%"></span></div>
      <div class="form-head">
        <small>送出前確認</small>
        <h2>請確認您的申請資料</h2>
        <p>送出後合作社幹部將查看資料並致電與您確認。</p>
      </div>
      <div class="summary">
        <div><span>服務項目</span><strong>果樹枝條粉碎</strong></div>
        <div><span>作物種類</span><strong>${f.crop}</strong></div>
        <div><span>施工地點</span><strong>${f.area} · ${f.location}</strong></div>
        <div><span>農地面積</span><strong>${f.size} ${f.unit}</strong></div>
        <div><span>枝條數量</span><strong>${f.branches}</strong></div>
        <div><span>希望日期</span><strong>${f.date} (${f.flex})</strong></div>
        <div><span>聯絡人</span><strong>${f.contact}</strong></div>
        <div><span>電話號碼</span><strong>${f.phone}</strong></div>
        <div><span>備註</span><strong>${f.note || '無特殊備註'}</strong></div>
      </div>
      <button class="primary" id="btn-submit-booking">確認送出服務申請</button>
      <button class="secondary" style="margin-top:10px" data-go="form">返回修改</button>
    </div>
  `;
}

function submitBooking() {
  const nextNum = adminBookings.length + 1;
  const newId = 'XN-DEMO-' + String(nextNum).padStart(3, '0');
  const newBooking = {
    id: newId,
    name: formData.contact || '新申請農友',
    phone: formData.phone || '0912-000-000',
    service: '果樹枝條粉碎',
    crop: formData.crop || '芭樂',
    area: formData.area || '燕巢',
    location: formData.location || '農地現場',
    size: `${formData.size || '3'} ${formData.unit || '分'}`,
    branches: formData.branches || '中量',
    hopeDate: formData.date || '2026-10-02',
    flex: formData.flex || '前後 3 天皆可',
    note: formData.note || '無特殊備註',
    time: '剛剛送出',
    createdAt: '剛剛送出',
    status: 'to_contact',
    lineFriend: true
  };

  adminBookings.unshift(newBooking);
  saveBookings();
  latestCustomerBookingId = newId;

  updateAdminStats();
  renderAdminCards();
  navigate('success');
}

function navigate(next, remember = true) {
  if (remember && route !== next) historyStack.push(route);
  route = next;
  renderCustomerScreen();
}

function renderCustomerScreen() {
  if (!screen) return;
  screen.innerHTML = templates[route]();
  if (backBtn) backBtn.hidden = (route === 'welcome');
  screen.scrollTop = 0;
  bindCustomerEvents();
}

function bindCustomerEvents() {
  screen.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.go));
  });
  screen.querySelectorAll('[data-toast]').forEach(el => {
    el.addEventListener('click', () => showToast(el.dataset.toast));
  });

  const form = screen.querySelector('#booking-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.querySelector('#form-error').hidden = false;
        form.reportValidity();
        return;
      }
      formData = {
        crop: form.crop.value,
        area: form.area.value,
        location: form.location.value.trim(),
        size: form.size.value,
        unit: form.unit.value,
        branches: form.branches.value,
        date: form.date.value,
        flex: form.flex.value,
        contact: form.contact.value.trim(),
        phone: form.phone.value.trim(),
        note: form.note.value.trim()
      };
      navigate('review');
    });
  }

  const submitBtn = screen.querySelector('#btn-submit-booking');
  if (submitBtn) submitBtn.addEventListener('click', submitBooking);
}

if (backBtn) {
  backBtn.addEventListener('click', () => {
    if (historyStack.length > 0) {
      route = historyStack.pop();
      renderCustomerScreen();
    }
  });
}

// ==========================================
// 3. 合作社端手機介面邏輯 (極簡基礎版)
// ==========================================
const adminToast = document.querySelector('#admin-mobile-toast');
function showAdminToast(msg) {
  if (!adminToast) return;
  adminToast.textContent = msg;
  adminToast.classList.add('show');
  setTimeout(() => adminToast.classList.remove('show'), 2800);
}

// 3.1 統計數字更新
function updateAdminStats() {
  const totalCount = adminBookings.length;
  const toContactCount = adminBookings.filter(b => b.status === 'to_contact').length;
  const processingCount = adminBookings.filter(b => b.status === 'processing').length;
  const closedCount = adminBookings.filter(b => b.status === 'closed').length;

  const elAll = document.querySelector('#stat-count-all');
  const elToContact = document.querySelector('#stat-count-to_contact');
  const elProcessing = document.querySelector('#stat-count-processing');
  const elClosed = document.querySelector('#stat-count-closed');
  const navBadge = document.querySelector('#nav-badge-count');

  if (elAll) elAll.textContent = String(totalCount).padStart(2, '0');
  if (elToContact) elToContact.textContent = String(toContactCount).padStart(2, '0');
  if (elProcessing) elProcessing.textContent = String(processingCount).padStart(2, '0');
  if (elClosed) elClosed.textContent = String(closedCount).padStart(2, '0');
  if (navBadge) navBadge.textContent = toContactCount;
}

// 綁定 Stat Chips 點擊篩選
document.querySelectorAll('.stat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.stat-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentAdminFilter = chip.dataset.filter;
    renderAdminCards();
  });
});

// 3.2 渲染申請單卡片
function renderAdminCards() {
  const container = document.querySelector('#admin-cards-container');
  if (!container) return;

  let list = adminBookings;

  if (currentAdminFilter !== 'all') {
    list = list.filter(b => b.status === currentAdminFilter);
  }

  if (currentAdminSearch.trim()) {
    const q = currentAdminSearch.trim().toLowerCase();
    list = list.filter(b => {
      return (b.name && b.name.toLowerCase().includes(q)) ||
             (b.phone && b.phone.includes(q)) ||
             (b.area && b.area.toLowerCase().includes(q)) ||
             (b.id && b.id.toLowerCase().includes(q));
    });
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 16px;color:var(--muted);background:#fff;border-radius:12px">
        <p style="font-size:24px;margin:0 0 8px">📋</p>
        <p style="font-weight:700;margin:0">目前無相符案件</p>
        <small>可點選上方「全部」或清空搜尋字詞</small>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(b => {
    const st = getStatusInfo(b.status);
    return `
      <div class="admin-card" id="card-${b.id}">
        <div class="admin-card-head">
          <div>
            <span class="card-sn">${b.id}</span>
            <span class="card-time">${b.time}</span>
          </div>
          <span class="status-pill ${st.key}">${st.pillText}</span>
        </div>

        <div class="admin-card-main">
          <div class="applicant-name">${b.name}</div>
          <div class="applicant-service">${b.service}・${b.crop}</div>
        </div>

        <div class="card-details-grid">
          <div class="detail-item">
            <span class="label">📍 施工地點</span>
            <span class="val">${b.area}（${b.location}）</span>
          </div>
          <div class="detail-item">
            <span class="label">🌾 面積</span>
            <span class="val">${b.size}</span>
          </div>
          <div class="detail-item">
            <span class="label">📅 希望日期</span>
            <span class="val">${b.hopeDate} <small style="color:var(--muted)">(${b.flex})</small></span>
          </div>
          <div class="detail-item">
            <span class="label">🌿 枝條數量</span>
            <span class="val">${b.branches}</span>
          </div>
        </div>

        <div class="card-foot-actions">
          <button class="btn-call-primary" data-action="call" data-phone="${b.phone}" data-name="${b.name}">
            📞 撥打電話
          </button>
          <button class="btn-view-detail" data-action="detail" data-id="${b.id}">
            查看資料
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 綁定卡片按鈕事件
  container.querySelectorAll('[data-action="call"]').forEach(btn => {
    btn.addEventListener('click', () => {
      triggerPhoneCall(btn.dataset.name, btn.dataset.phone);
    });
  });

  container.querySelectorAll('[data-action="detail"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = adminBookings.find(b => b.id === btn.dataset.id);
      if (item) openDetailModal(item);
    });
  });
}

// 3.3 服務申請詳情 Sheet Modal
const detailModal = document.querySelector('#detail-modal');
const detailModalBody = document.querySelector('#detail-modal-body');
const closeDetailBtn = document.querySelector('#btn-close-detail');

function openDetailModal(b) {
  if (!detailModal || !detailModalBody) return;

  detailModalBody.innerHTML = `
    <!-- 申請資訊 -->
    <div class="detail-section">
      <div class="section-heading">申請資訊</div>
      <div class="detail-row">
        <span class="row-label">申請編號</span>
        <span class="row-value" style="color:var(--green-900)">${b.id}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">申請時間</span>
        <span class="row-value">${b.time}</span>
      </div>
    </div>

    <!-- 顧客聯絡資料 -->
    <div class="detail-section" style="background:#f5faf2;border:1px solid #c2e2c5">
      <div class="section-heading" style="color:var(--green-700)">顧客聯絡資料</div>
      <div class="detail-row">
        <span class="row-label">聯絡人</span>
        <span class="row-value" style="font-size:16px">${b.name}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">電話</span>
        <span class="row-value" style="font-size:16px;color:var(--green-900)">${b.phone}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">LINE</span>
        <span class="row-value" style="color:#16a34a">✅ 已加入行農合作社官方帳號</span>
      </div>
      <button class="btn-call-primary" id="btn-modal-call" style="margin-top:6px;width:100%">
        📞 立即撥打電話給 ${b.name}
      </button>
    </div>

    <!-- 服務內容 -->
    <div class="detail-section">
      <div class="section-heading">服務需求</div>
      <div class="detail-row">
        <span class="row-label">服務項目</span>
        <span class="row-value">${b.service}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">作物種類</span>
        <span class="row-value">${b.crop}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">施工地點</span>
        <span class="row-value">${b.area} · ${b.location}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">農地面積</span>
        <span class="row-value">${b.size}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">枝條數量</span>
        <span class="row-value">${b.branches}</span>
      </div>
    </div>

    <!-- 希望施工時間 -->
    <div class="detail-section">
      <div class="section-heading">希望時間</div>
      <div class="detail-row">
        <span class="row-label">希望施工日期</span>
        <span class="row-value" style="color:#d97706;font-size:15px">📅 ${b.hopeDate}</span>
      </div>
      <div class="detail-row">
        <span class="row-label">日期彈性</span>
        <span class="row-value">${b.flex}</span>
      </div>
    </div>

    <!-- 備註 -->
    <div class="detail-section">
      <div class="section-heading">備註說明</div>
      <p style="margin:2px 0;font-size:13px;line-height:1.6;color:var(--ink)">
        ${b.note || '無特殊備註。'}
      </p>
    </div>

    <!-- 處理狀態直接切換 -->
    <div class="detail-section" style="border:1px solid #ddd6c8">
      <div class="section-heading">處理狀態</div>
      <div class="status-radio-group">
        <label class="status-radio-label">
          <input type="radio" name="modal_status" value="to_contact" ${b.status === 'to_contact' ? 'checked' : ''}>
          <span>待聯絡</span>
        </label>
        <label class="status-radio-label">
          <input type="radio" name="modal_status" value="processing" ${b.status === 'processing' ? 'checked' : ''}>
          <span>處理中</span>
        </label>
        <label class="status-radio-label">
          <input type="radio" name="modal_status" value="closed" ${b.status === 'closed' ? 'checked' : ''}>
          <span>已結案</span>
        </label>
      </div>
    </div>
  `;

  // 撥電話
  const modalCallBtn = detailModalBody.querySelector('#btn-modal-call');
  if (modalCallBtn) {
    modalCallBtn.addEventListener('click', () => triggerPhoneCall(b.name, b.phone));
  }

  // 狀態切換即時存檔
  detailModalBody.querySelectorAll('input[name="modal_status"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const newStatus = e.target.value;
      b.status = newStatus;
      saveBookings();
      updateAdminStats();
      renderAdminCards();
      showAdminToast(`案件 ${b.id} 狀態已更新為「${getStatusInfo(newStatus).label}」`);
    });
  });

  detailModal.hidden = false;
}

function closeDetailModal() {
  if (detailModal) detailModal.hidden = true;
}

if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeDetailModal);
if (detailModal) {
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });
}

// 3.5 搜尋輸入
const searchInput = document.querySelector('#admin-mobile-search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    currentAdminSearch = e.target.value;
    renderAdminCards();
  });
}

// 3.6 底部 Navigation
document.querySelectorAll('.bottom-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentAdminTab = tab.dataset.tab;

    const bookingsPanel = document.querySelector('#tab-panel-bookings');
    const otherPanel = document.querySelector('#tab-panel-other');

    if (currentAdminTab === 'bookings') {
      if (bookingsPanel) bookingsPanel.hidden = false;
      if (otherPanel) otherPanel.hidden = true;
      renderAdminCards();
    } else {
      if (bookingsPanel) bookingsPanel.hidden = true;
      if (otherPanel) otherPanel.hidden = false;
    }
  });
});

// 3.7 通知鈴鐺
const noticeBtn = document.querySelector('#admin-notice-btn');
if (noticeBtn) {
  noticeBtn.addEventListener('click', () => {
    const toContactCount = adminBookings.filter(b => b.status === 'to_contact').length;
    showAdminToast(`🔔 目前共有 ${toContactCount} 筆新申請「待聯絡」`);
  });
}

// 3.8 頂部視角切換器 (顧客手機 / 合作社端)
function switchView(targetView) {
  document.querySelectorAll('.view-switch').forEach(b => {
    b.classList.toggle('active', b.dataset.view === targetView);
  });
  const mobileStage = document.querySelector('#mobile-view');
  const adminMobileStage = document.querySelector('#admin-mobile-view');

  if (mobileStage) mobileStage.hidden = (targetView !== 'mobile');
  if (adminMobileStage) adminMobileStage.hidden = (targetView !== 'admin-mobile');

  if (targetView === 'admin-mobile') {
    updateAdminStats();
    renderAdminCards();
  } else if (targetView === 'mobile') {
    renderCustomerScreen();
  }
}

document.querySelectorAll('.view-switch').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ==========================================
// 4. 初始化執行
// ==========================================
renderCustomerScreen();
updateAdminStats();
renderAdminCards();
