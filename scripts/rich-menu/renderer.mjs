import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export const CANVAS_WIDTH = 2500;
export const CANVAS_HEIGHT = 1686;
export const MAX_FILE_SIZE = 1048576; // 1 MB (LINE API limit)

/**
 * Escapes XML/SVG special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates deterministic SVG markup from a validated Menu Spec
 */
export function generateMenuSvg(menuSpec) {
  if (menuSpec.type === 'admin') {
    return generateAdminMenuSvg(menuSpec);
  }

  const leftBtn = menuSpec.buttons.find(b => b.id === 'booking') || menuSpec.buttons[0];
  const rightBtn = menuSpec.buttons.find(b => b.id === 'query') || menuSpec.buttons[1];

  // Derive geometry dynamically from spec button bounds (shared geometry)
  const b1 = leftBtn?.bounds || { x: 0, y: 0, width: 1250, height: CANVAS_HEIGHT };
  const b2 = rightBtn?.bounds || { x: 1250, y: 0, width: 1250, height: CANVAS_HEIGHT };

  const primaryColor = menuSpec.theme?.primaryColor || '#173820';
  const secondaryColor = menuSpec.theme?.secondaryColor || '#854d0e';
  const stationName = menuSpec.name?.replace('預設選單 - ', '') || '服務站';

  const card1MarginX = Math.round(b1.width * 0.08);
  const card1X = b1.x + card1MarginX;
  const card1Width = b1.width - (card1MarginX * 2);
  const card1Y = b1.y + 220;
  const card1Height = b1.height - 380;
  const center1X = b1.x + Math.round(b1.width / 2);

  const card2MarginX = Math.round(b2.width * 0.08);
  const card2X = b2.x + card2MarginX;
  const card2Width = b2.width - (card2MarginX * 2);
  const card2Y = b2.y + 220;
  const card2Height = b2.height - 380;
  const center2X = b2.x + Math.round(b2.width / 2);

  const badge1X = b1.x + 120;
  const badge1TextX = b1.x + 360;
  const badge2X = b2.x + 120;
  const badge2TextX = b2.x + 360;
  const dividerX = b2.x;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
  <defs>
    <!-- Background Canvas Warm Earth Kraft Gradients (Variant 1: Non-white Oatmeal Earth) -->
    <linearGradient id="canvasGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e8e1d5" />
      <stop offset="100%" stop-color="#ded5c5" />
    </linearGradient>

    <!-- Warm Soft Shadow for floating cards -->
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#3a2d1d" flood-opacity="0.12" />
    </filter>

    <!-- Button shadow -->
    <filter id="btnShadowGreen" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="${primaryColor}" flood-opacity="0.28" />
    </filter>
    <filter id="btnShadowAmber" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="${secondaryColor}" flood-opacity="0.28" />
    </filter>
  </defs>

  <style>
    .font-base {
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', -apple-system, sans-serif;
    }
    .title-booking {
      font-size: 104px;
      font-weight: 800;
      fill: #173820;
      letter-spacing: 2px;
    }
    .title-query {
      font-size: 104px;
      font-weight: 800;
      fill: #3d250d;
      letter-spacing: 2px;
    }
    .subtitle-booking {
      font-size: 44px;
      font-weight: 500;
      fill: #475e46;
      letter-spacing: 1px;
    }
    .subtitle-query {
      font-size: 44px;
      font-weight: 500;
      fill: #6b5134;
      letter-spacing: 1px;
    }
    .tag-text-green {
      font-size: 36px;
      font-weight: 700;
      fill: #15803d;
      letter-spacing: 1px;
    }
    .tag-text-amber {
      font-size: 36px;
      font-weight: 700;
      fill: #78440d;
      letter-spacing: 1px;
    }
    .btn-badge-text {
      font-size: 46px;
      font-weight: 700;
      letter-spacing: 1.5px;
    }
    .station-text-green {
      font-size: 38px;
      font-weight: 700;
      fill: #173820;
      letter-spacing: 1px;
    }
    .station-text-amber {
      font-size: 38px;
      font-weight: 700;
      fill: #6e3f0c;
      letter-spacing: 1px;
    }
  </style>

  <!-- Canvas Background (Warm Earth Oatmeal Kraft) -->
  <rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#canvasGrad)" />

  <!-- Geometric zone rects to preserve boundary responsiveness -->
  <rect x="${b1.x}" y="${b1.y}" width="${b1.width}" height="${b1.height}" fill="transparent" />
  <rect x="${b2.x}" y="${b2.y}" width="${b2.width}" height="${b2.height}" fill="transparent" />

  <!-- Center divider (Warm earth dashed line) -->
  <line x1="${dividerX}" y1="0" x2="${dividerX}" y2="${CANVAS_HEIGHT}" stroke="#cbbea9" stroke-width="4" stroke-dasharray="16,10" />

  <!-- Top Station Brand Badges -->
  <g transform="translate(0, 75)">
    <!-- Left badge: Soft Sage Theme -->
    <rect x="${badge1X}" y="0" width="480" height="76" rx="38" fill="#d5e4d3" stroke="#b3cfaf" stroke-width="2.5" />
    <text x="${badge1TextX}" y="52" class="font-base station-text-green" text-anchor="middle">🌱 ${escapeXml(stationName)}</text>

    <!-- Right badge: Warm Wheat Theme -->
    <rect x="${badge2X}" y="0" width="480" height="76" rx="38" fill="#edd9b9" stroke="#d6b889" stroke-width="2.5" />
    <text x="${badge2TextX}" y="52" class="font-base station-text-amber" text-anchor="middle">📋 預約服務入口</text>
  </g>

  <!-- ================= LEFT BUTTON (BOOKING) ================= -->
  <!-- Card Container: Soft Sprout Sage Card (#f2f7f1) -->
  <rect x="${card1X}" y="${card1Y}" width="${card1Width}" height="${card1Height}" rx="56" fill="#f2f7f1" stroke="#c2dec0" stroke-width="3.5" filter="url(#cardShadow)" />

  <!-- Calendar Icon Graphic -->
  <g transform="translate(${center1X}, 530)">
    <!-- Halo ring -->
    <circle cx="0" cy="0" r="160" fill="#d4ebd2" />
    <circle cx="0" cy="0" r="125" fill="#173820" />
    <!-- White Calendar Vector Icon -->
    <g transform="translate(-66, -66) scale(5.5)" fill="#ffffff">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
    </g>
  </g>

  <!-- Title & Subtitle -->
  <text x="${center1X}" y="845" class="font-base title-booking" text-anchor="middle">${escapeXml(leftBtn.title)}</text>
  <text x="${center1X}" y="940" class="font-base subtitle-booking" text-anchor="middle">${escapeXml(leftBtn.subtitle)}</text>

  <!-- Feature Tag Capsule -->
  <g transform="translate(${center1X}, 1040)">
    <rect x="-310" y="-45" width="620" height="90" rx="24" fill="#dceddb" stroke="#b3d9b1" stroke-width="2" />
    <text x="0" y="14" class="font-base tag-text-green" text-anchor="middle">🌾 果樹粉碎 · 代耕 · 農機出租</text>
  </g>

  <!-- Action Pill Button (Primary Forest Green) -->
  <g transform="translate(${center1X}, 1250)">
    <rect x="-370" y="-62" width="740" height="124" rx="62" fill="#173820" filter="url(#btnShadowGreen)" />
    <text x="0" y="18" class="font-base btn-badge-text" text-anchor="middle" fill="#ffffff">🌱 立即線上填單 ➔</text>
  </g>

  <!-- ================= RIGHT BUTTON (QUERY) ================= -->
  <!-- Card Container: Soft Warm Wheat Card (#faf4e8) -->
  <rect x="${card2X}" y="${card2Y}" width="${card2Width}" height="${card2Height}" rx="56" fill="#faf4e8" stroke="#e8d4b3" stroke-width="3.5" filter="url(#cardShadow)" />

  <!-- Search/Document Icon Graphic -->
  <g transform="translate(${center2X}, 530)">
    <!-- Halo ring -->
    <circle cx="0" cy="0" r="160" fill="#f3e3c6" />
    <circle cx="0" cy="0" r="125" fill="#854d0e" />
    <!-- White Document/Search Vector Icon -->
    <g transform="translate(-66, -66) scale(5.5)" fill="#ffffff">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </g>
  </g>

  <!-- Title & Subtitle -->
  <text x="${center2X}" y="845" class="font-base title-query" text-anchor="middle">${escapeXml(rightBtn.title)}</text>
  <text x="${center2X}" y="940" class="font-base subtitle-query" text-anchor="middle">${escapeXml(rightBtn.subtitle)}</text>

  <!-- Feature Tag Capsule -->
  <g transform="translate(${center2X}, 1040)">
    <rect x="-310" y="-45" width="620" height="90" rx="24" fill="#f2e2c4" stroke="#dec497" stroke-width="2" />
    <text x="0" y="14" class="font-base tag-text-amber" text-anchor="middle">📱 左右滑動 · 查閱進度與叮嚀</text>
  </g>

  <!-- Action Pill Button (Warm Earth Golden Amber) -->
  <g transform="translate(${center2X}, 1250)">
    <rect x="-370" y="-62" width="740" height="124" rx="62" fill="#854d0e" filter="url(#btnShadowAmber)" />
    <text x="0" y="18" class="font-base btn-badge-text" text-anchor="middle" fill="#ffffff">📋 查看預約進度 ➔</text>
  </g>
</svg>`;

}

/**
 * Generates deterministic SVG markup for Admin Dual-Hub 6-Action Rich Menu
 */
export function generateAdminMenuSvg(menuSpec) {
  const stationName = menuSpec.stationName || menuSpec.name?.replace('管理幹部選單 - ', '') || '服務站';

  const b1 = menuSpec.buttons.find(b => b.id === 'admin_to_contact') || menuSpec.buttons[0];
  const b2 = menuSpec.buttons.find(b => b.id === 'admin_confirmed') || menuSpec.buttons[1];
  const b3 = menuSpec.buttons.find(b => b.id === 'admin_settings') || menuSpec.buttons[2];
  const b4 = menuSpec.buttons.find(b => b.id === 'admin_manual_booking') || menuSpec.buttons[3];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
  <defs>
    <!-- Background Canvas Warm Earth Kraft Gradients -->
    <linearGradient id="adminBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f4eee4" />
      <stop offset="100%" stop-color="#e8ddcc" />
    </linearGradient>

    <!-- Warm Soft Shadow for floating cards -->
    <filter id="adminCardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#3a2d1d" flood-opacity="0.12" />
    </filter>

    <filter id="adminIconShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.18" />
    </filter>
  </defs>

  <style>
    .font-base {
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', -apple-system, sans-serif;
    }
    .header-station {
      font-size: 42px;
      font-weight: 800;
      fill: #ffffff;
      letter-spacing: 2px;
    }
    .header-sub {
      font-size: 26px;
      font-weight: 500;
      fill: #c8ad86;
      letter-spacing: 1px;
    }
    .btn-badge {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 1px;
    }
    .btn-title {
      font-size: 68px;
      font-weight: 900;
      letter-spacing: 2px;
    }
    .btn-sub {
      font-size: 34px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .arrow-icon {
      font-size: 54px;
      font-weight: 900;
    }
  </style>

  <!-- Background -->
  <rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#adminBgGrad)" />

  <!-- Top Navigation Header Bar [0, 0, 2500, 210] -->
  <rect x="0" y="0" width="${CANVAS_WIDTH}" height="210" fill="#173820" />
  <rect x="0" y="204" width="${CANVAS_WIDTH}" height="6" fill="#c8ad86" />

  <g transform="translate(100, 48)">
    <!-- Station Tag -->
    <rect x="0" y="18" width="320" height="68" rx="34" fill="#245330" stroke="#3e7a4f" stroke-width="2" />
    <text x="160" y="64" class="font-base" font-size="30" font-weight="800" fill="#dcebd6" text-anchor="middle">🌱 ${escapeXml(stationName)}</text>
    <!-- Header Title -->
    <text x="360" y="68" class="font-base header-station">幹部調度工作台</text>
    <text x="730" y="68" class="font-base header-sub">｜ 現場調度與預約管理專用</text>
  </g>

  <!-- ================= GRID 1: 待審確認 [100, 270, 1110, 640] ================= -->
  <g transform="translate(100, 270)">
    <rect x="0" y="0" width="1110" height="640" rx="44" fill="#ffffff" stroke="#c5dfc2" stroke-width="3.5" filter="url(#adminCardShadow)" />
    <path d="M 0 44 Q 0 0 44 0 L 1066 0 Q 1110 0 1110 44 L 1110 56 L 0 56 Z" fill="#1e532b" />
    
    <rect x="60" y="90" width="200" height="60" rx="30" fill="#e2f0e0" />
    <text x="160" y="132" class="font-base btn-badge" fill="#1e532b" text-anchor="middle">新單進線</text>

    <rect x="60" y="190" width="260" height="260" rx="38" fill="#d8ebd5" />
    <circle cx="190" cy="320" r="96" fill="#173820" filter="url(#adminIconShadow)" />
    <g transform="translate(142, 272) scale(4)" fill="#ffffff">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </g>

    <text x="360" y="275" class="font-base btn-title" fill="#173820">${escapeXml(b1.title)}</text>
    <text x="360" y="365" class="font-base btn-sub" fill="#475e46">${escapeXml(b1.subtitle)}</text>
    <text x="360" y="430" class="font-base" font-size="28" font-weight="500" fill="#71886f">致電農民確認田區條件與派工細節</text>

    <rect x="60" y="505" width="990" height="85" rx="24" fill="#f2f8f1" stroke="#cde4cb" stroke-width="2" />
    <text x="110" y="558" class="font-base" font-size="32" font-weight="800" fill="#1e532b">前往審查派單</text>
    <text x="1000" y="562" class="font-base arrow-icon" fill="#1e532b" text-anchor="middle">➔</text>
  </g>

  <!-- ================= GRID 2: 施工排程 [1290, 270, 1110, 640] ================= -->
  <g transform="translate(1290, 270)">
    <rect x="0" y="0" width="1110" height="640" rx="44" fill="#ffffff" stroke="#b8d8e8" stroke-width="3.5" filter="url(#adminCardShadow)" />
    <path d="M 0 44 Q 0 0 44 0 L 1066 0 Q 1110 0 1110 44 L 1110 56 L 0 56 Z" fill="#1d567a" />

    <rect x="60" y="90" width="200" height="60" rx="30" fill="#e0eff8" />
    <text x="160" y="132" class="font-base btn-badge" fill="#1d567a" text-anchor="middle">工班出車</text>

    <rect x="60" y="190" width="260" height="260" rx="38" fill="#d4e9f5" />
    <circle cx="190" cy="320" r="96" fill="#1d567a" filter="url(#adminIconShadow)" />
    <g transform="translate(142, 272) scale(4)" fill="#ffffff">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
    </g>

    <text x="360" y="275" class="font-base btn-title" fill="#143f5a">${escapeXml(b2.title)}</text>
    <text x="360" y="365" class="font-base btn-sub" fill="#3a637d">${escapeXml(b2.subtitle)}</text>
    <text x="360" y="430" class="font-base" font-size="28" font-weight="500" fill="#5f8197">本日已確認施作名冊與機具派工調度</text>

    <rect x="60" y="505" width="990" height="85" rx="24" fill="#f0f7fb" stroke="#cce3f0" stroke-width="2" />
    <text x="110" y="558" class="font-base" font-size="32" font-weight="800" fill="#1d567a">檢視今日行程</text>
    <text x="1000" y="562" class="font-base arrow-icon" fill="#1d567a" text-anchor="middle">➔</text>
  </g>

  <!-- ================= GRID 3: 休假預定 [100, 970, 1110, 640] ================= -->
  <g transform="translate(100, 970)">
    <rect x="0" y="0" width="1110" height="640" rx="44" fill="#ffffff" stroke="#ebc8c2" stroke-width="3.5" filter="url(#adminCardShadow)" />
    <path d="M 0 44 Q 0 0 44 0 L 1066 0 Q 1110 0 1110 44 L 1110 56 L 0 56 Z" fill="#992b23" />

    <rect x="60" y="90" width="200" height="60" rx="30" fill="#fae8e6" />
    <text x="160" y="132" class="font-base btn-badge" fill="#992b23" text-anchor="middle">規則管理</text>

    <rect x="60" y="190" width="260" height="260" rx="38" fill="#f8dfdc" />
    <circle cx="190" cy="320" r="96" fill="#992b23" filter="url(#adminIconShadow)" />
    <g transform="translate(142, 272) scale(4)" fill="#ffffff">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </g>

    <text x="360" y="275" class="font-base btn-title" fill="#691a14">${escapeXml(b3.title)}</text>
    <text x="360" y="365" class="font-base btn-sub" fill="#8f3a33">${escapeXml(b3.subtitle)}</text>
    <text x="360" y="430" class="font-base" font-size="28" font-weight="500" fill="#a45852">機具保養、氣候豪雨暫停線上預約</text>

    <rect x="60" y="505" width="990" height="85" rx="24" fill="#fdf5f4" stroke="#f2d5d2" stroke-width="2" />
    <text x="110" y="558" class="font-base" font-size="32" font-weight="800" fill="#992b23">設定公休時段</text>
    <text x="1000" y="562" class="font-base arrow-icon" fill="#992b23" text-anchor="middle">➔</text>
  </g>

  <!-- ================= GRID 4: 代客排單 [1290, 970, 1110, 640] ================= -->
  <g transform="translate(1290, 970)">
    <rect x="0" y="0" width="1110" height="640" rx="44" fill="#ffffff" stroke="#dfcfc8" stroke-width="3.5" filter="url(#adminCardShadow)" />
    <path d="M 0 44 Q 0 0 44 0 L 1066 0 Q 1110 0 1110 44 L 1110 56 L 0 56 Z" fill="#844129" />

    <rect x="60" y="90" width="200" height="60" rx="30" fill="#fbe5dc" />
    <text x="160" y="132" class="font-base btn-badge" fill="#844129" text-anchor="middle">電話來電</text>

    <rect x="60" y="190" width="260" height="260" rx="38" fill="#f5ded5" />
    <circle cx="190" cy="320" r="96" fill="#844129" filter="url(#adminIconShadow)" />
    <g transform="translate(142, 272) scale(4)" fill="#ffffff">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </g>

    <text x="360" y="275" class="font-base btn-title" fill="#542514">${escapeXml(b4.title)}</text>
    <text x="360" y="365" class="font-base btn-sub" fill="#7d4734">${escapeXml(b4.subtitle)}</text>
    <text x="360" y="430" class="font-base" font-size="28" font-weight="500" fill="#966655">農民電話叫工，幹部現場快速登打入庫</text>

    <rect x="60" y="505" width="990" height="85" rx="24" fill="#fdf6f4" stroke="#eedad3" stroke-width="2" />
    <text x="110" y="558" class="font-base" font-size="32" font-weight="800" fill="#844129">開啟代填表單</text>
    <text x="1000" y="562" class="font-base arrow-icon" fill="#844129" text-anchor="middle">➔</text>
  </g>
</svg>`;
}


/**
 * Renders a validated Menu Spec to a PNG/JPEG Buffer and optionally writes to file
 */
export async function renderMenuImage(menuSpec, options = {}) {
  const svg = generateMenuSvg(menuSpec);
  const format = options.format || 'png'; // 'png' or 'jpeg'

  let sharpInstance = sharp(Buffer.from(svg), { density: 150 })
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT);

  let buffer;
  if (format === 'jpeg' || format === 'jpg') {
    buffer = await sharpInstance
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } else {
    buffer = await sharpInstance
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  }

  // Validate output limits
  if (buffer.length > MAX_FILE_SIZE) {
    // If PNG exceeds 1MB, try high quality JPEG optimization fallback
    console.warn(`[Renderer] Image size (${buffer.length} bytes) exceeds 1MB, applying JPEG optimization fallback`);
    buffer = await sharp(Buffer.from(svg), { density: 150 })
      .resize(CANVAS_WIDTH, CANVAS_HEIGHT)
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`RENDER_ERROR: Rendered image size (${buffer.length} bytes) exceeds LINE 1MB limit (${MAX_FILE_SIZE} bytes)`);
  }

  // Output to file if destination requested
  if (options.outputPath) {
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, buffer);
  }

  return {
    buffer,
    sizeBytes: buffer.length,
    format,
    dimensions: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT
    },
    svg
  };
}

// Allow CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const specPath = path.join(rootDir, '.booking/rich-menu/targets.json');
  if (!fs.existsSync(specPath)) {
    console.error('Missing targets.json! Please run Ep02-0 and Ep02-1 first.');
    process.exit(1);
  }

  const { buildMenuSpec } = await import('./builder.mjs');
  const targets = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const spec = buildMenuSpec(targets);

  const outPath = path.join(rootDir, '.booking/rich-menu/preview.png');
  renderMenuImage(spec, { outputPath: outPath })
    .then(({ sizeBytes, dimensions }) => {
      console.log('Rendering completed:');
      console.log(`Saved preview: ${outPath}`);
      console.log(`Dimensions: ${dimensions.width}x${dimensions.height}`);
      console.log(`Size: ${sizeBytes} bytes (${(sizeBytes / 1024).toFixed(1)} KB)`);
    })
    .catch((err) => {
      console.error('Rendering error:', err);
      process.exit(1);
    });
}
