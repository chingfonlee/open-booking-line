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

  const primaryColor = menuSpec.theme?.primaryColor || '#14532d';
  const secondaryColor = menuSpec.theme?.secondaryColor || '#0f172a';
  const stationName = menuSpec.name?.replace('預設選單 - ', '') || '服務站';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
  <defs>
    <!-- Gradients -->
    <linearGradient id="leftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="#166534" />
    </linearGradient>
    <linearGradient id="rightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${secondaryColor}" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <style>
    .font-base {
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', -apple-system, sans-serif;
    }
    .title {
      font-size: 104px;
      font-weight: 800;
      fill: #ffffff;
      letter-spacing: 2px;
    }
    .subtitle {
      font-size: 46px;
      font-weight: 500;
      fill: #e2e8f0;
      letter-spacing: 1px;
    }
    .btn-badge-text {
      font-size: 40px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .station-text {
      font-size: 38px;
      font-weight: 600;
      fill: #cbd5e1;
      letter-spacing: 2px;
    }
  </style>

  <!-- Left Half: Online Booking Background -->
  <rect x="0" y="0" width="1250" height="${CANVAS_HEIGHT}" fill="url(#leftGrad)" />

  <!-- Right Half: Query Progress Background -->
  <rect x="1250" y="0" width="1250" height="${CANVAS_HEIGHT}" fill="url(#rightGrad)" />

  <!-- Subtle grid & border details -->
  <line x1="1250" y1="0" x2="1250" y2="${CANVAS_HEIGHT}" stroke="#ffffff" stroke-opacity="0.2" stroke-width="4" stroke-dasharray="16,8" />

  <!-- Top Station Brand Badges -->
  <g transform="translate(0, 80)">
    <rect x="120" y="0" width="480" height="70" rx="35" fill="#000000" fill-opacity="0.25" />
    <text x="360" y="48" class="font-base station-text" text-anchor="middle">🌱 ${escapeXml(stationName)}</text>

    <rect x="1370" y="0" width="480" height="70" rx="35" fill="#000000" fill-opacity="0.25" />
    <text x="1610" y="48" class="font-base station-text" text-anchor="middle">🔍 預約管理與查詢</text>
  </g>

  <!-- ================= LEFT BUTTON (BOOKING) ================= -->
  <!-- Card Container -->
  <rect x="100" y="240" width="1050" height="1280" rx="48" fill="url(#cardGrad)" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3" filter="url(#shadow)" />

  <!-- Calendar Icon Circle -->
  <g transform="translate(625, 540)">
    <circle cx="0" cy="0" r="160" fill="#22c55e" fill-opacity="0.25" />
    <circle cx="0" cy="0" r="130" fill="#22c55e" />
    <!-- White Calendar Vector Graphic -->
    <g transform="translate(-65, -70) scale(1.3)" fill="#ffffff">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
    </g>
  </g>

  <!-- Title & Subtitle -->
  <text x="625" y="870" class="font-base title" text-anchor="middle">${escapeXml(leftBtn.title)}</text>
  <text x="625" y="970" class="font-base subtitle" text-anchor="middle">${escapeXml(leftBtn.subtitle)}</text>

  <!-- Action Pill Button -->
  <g transform="translate(625, 1260)">
    <rect x="-360" y="-60" width="720" height="120" rx="60" fill="#22c55e" filter="url(#shadow)" />
    <text x="0" y="16" class="font-base btn-badge-text" text-anchor="middle" fill="#ffffff">立即前往填單 ➔</text>
  </g>

  <!-- ================= RIGHT BUTTON (QUERY) ================= -->
  <!-- Card Container -->
  <rect x="1350" y="240" width="1050" height="1280" rx="48" fill="url(#cardGrad)" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3" filter="url(#shadow)" />

  <!-- Search/Document Icon Circle -->
  <g transform="translate(1875, 540)">
    <circle cx="0" cy="0" r="160" fill="#3b82f6" fill-opacity="0.25" />
    <circle cx="0" cy="0" r="130" fill="#3b82f6" />
    <!-- White Document/Search Vector Graphic -->
    <g transform="translate(-65, -70) scale(1.3)" fill="#ffffff">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </g>
  </g>

  <!-- Title & Subtitle -->
  <text x="1875" y="870" class="font-base title" text-anchor="middle">${escapeXml(rightBtn.title)}</text>
  <text x="1875" y="970" class="font-base subtitle" text-anchor="middle">${escapeXml(rightBtn.subtitle)}</text>

  <!-- Action Pill Button -->
  <g transform="translate(1875, 1260)">
    <rect x="-360" y="-60" width="720" height="120" rx="60" fill="#3b82f6" filter="url(#shadow)" />
    <text x="0" y="16" class="font-base btn-badge-text" text-anchor="middle" fill="#ffffff">查看預約進度 ➔</text>
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
