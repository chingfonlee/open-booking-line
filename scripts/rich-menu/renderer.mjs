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
    <g transform="translate(-65, -70) scale(1.3)" fill="#ffffff">
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
    <g transform="translate(-65, -70) scale(1.3)" fill="#ffffff">
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
