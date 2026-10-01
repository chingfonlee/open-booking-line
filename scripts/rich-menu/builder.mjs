import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export const CANVAS_WIDTH = 2500;
export const CANVAS_HEIGHT = 1686;

export const DEFAULT_THEME = {
  primaryColor: '#166534',   // 深綠色 (預約主色)
  secondaryColor: '#1e293b', // 深深灰/海軍藍 (查詢主色)
  textColor: '#ffffff'       // 純白文字
};

/**
 * Checks if two bounding boxes overlap
 */
export function checkBoundsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Validates a LINE Rich Menu Object against official API requirements
 */
export function validateLineRichMenuObject(lineObj) {
  if (!lineObj || typeof lineObj !== 'object') {
    throw new Error('LINE_VALIDATION_ERROR: Rich menu object must be an object');
  }

  // 1. Size check
  if (!lineObj.size || lineObj.size.width !== CANVAS_WIDTH || lineObj.size.height !== CANVAS_HEIGHT) {
    throw new Error(`LINE_VALIDATION_ERROR: size must be ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
  }

  // 2. Name check
  if (typeof lineObj.name !== 'string' || lineObj.name.length < 1 || lineObj.name.length > 300) {
    throw new Error('LINE_VALIDATION_ERROR: name must be between 1 and 300 characters');
  }

  // 3. chatBarText check (LINE strictly limits to max 14 characters)
  if (typeof lineObj.chatBarText !== 'string' || lineObj.chatBarText.length < 1 || lineObj.chatBarText.length > 14) {
    throw new Error('LINE_VALIDATION_ERROR: chatBarText must be between 1 and 14 characters');
  }

  // 4. Areas check (1..20 items)
  if (!Array.isArray(lineObj.areas) || lineObj.areas.length < 1 || lineObj.areas.length > 20) {
    throw new Error('LINE_VALIDATION_ERROR: areas must contain between 1 and 20 elements');
  }

  for (let i = 0; i < lineObj.areas.length; i++) {
    const area = lineObj.areas[i];
    const { bounds, action } = area;

    if (!bounds || typeof bounds !== 'object') {
      throw new Error(`LINE_VALIDATION_ERROR: area[${i}].bounds is required`);
    }

    const { x, y, width, height } = bounds;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > CANVAS_WIDTH || y + height > CANVAS_HEIGHT) {
      throw new Error(`LINE_VALIDATION_ERROR: area[${i}].bounds out of canvas boundary (x=${x}, y=${y}, w=${width}, h=${height})`);
    }

    if (!action || typeof action !== 'object' || !action.type) {
      throw new Error(`LINE_VALIDATION_ERROR: area[${i}].action must have a valid type`);
    }

    if (action.type === 'uri') {
      if (!action.uri || typeof action.uri !== 'string' || !action.uri.match(/^(https?|line|tel):/)) {
        throw new Error(`LINE_VALIDATION_ERROR: area[${i}].action.uri must be a valid URI string`);
      }
    } else if (action.type === 'message') {
      if (!action.text || typeof action.text !== 'string' || action.text.length > 300) {
        throw new Error(`LINE_VALIDATION_ERROR: area[${i}].action.text must be a string up to 300 characters`);
      }
    }

    // Check overlap with subsequent areas
    for (let j = i + 1; j < lineObj.areas.length; j++) {
      if (checkBoundsOverlap(bounds, lineObj.areas[j].bounds)) {
        throw new Error(`LINE_VALIDATION_ERROR: area[${i}] and area[${j}] bounds overlap`);
      }
    }
  }

  return true;
}

/**
 * Builds deterministic Menu Spec from discovery targets & custom options
 */
export function buildMenuSpec(targets, options = {}) {
  if (!targets || !targets.booking?.target || !targets.query?.text) {
    throw new Error('SPEC_BUILD_ERROR: targets must contain booking.target and query.text');
  }

  const stationName = options.stationName || targets.station?.name || '服務站';
  const name = options.name || `預設選單 - ${stationName}`;
  const chatBarText = options.chatBarText || '快速選單';

  if (chatBarText.length > 14) {
    throw new Error(`SPEC_VALIDATION_ERROR: chatBarText "${chatBarText}" exceeds maximum length of 14 characters (length: ${chatBarText.length})`);
  }

  if (name.length > 300) {
    throw new Error(`SPEC_VALIDATION_ERROR: name exceeds maximum length of 300 characters (length: ${name.length})`);
  }

  const theme = {
    primaryColor: options.theme?.primaryColor || DEFAULT_THEME.primaryColor,
    secondaryColor: options.theme?.secondaryColor || DEFAULT_THEME.secondaryColor,
    textColor: options.theme?.textColor || DEFAULT_THEME.textColor
  };

  const bookingTitle = options.bookingTitle || '線上預約';
  const bookingSubtitle = options.bookingSubtitle || '即刻預約服務';
  const queryTitle = options.queryTitle || '查詢進度';
  const querySubtitle = options.querySubtitle || '檢視預約狀態';

  // Deterministic 2-column geometry (ADR-EP02-001)
  const halfWidth = Math.floor(CANVAS_WIDTH / 2); // 1250

  const buttons = [
    {
      id: 'booking',
      title: bookingTitle,
      subtitle: bookingSubtitle,
      bounds: {
        x: 0,
        y: 0,
        width: halfWidth,
        height: CANVAS_HEIGHT
      },
      action: {
        type: 'uri',
        uri: targets.booking.target
      }
    },
    {
      id: 'query',
      title: queryTitle,
      subtitle: querySubtitle,
      bounds: {
        x: halfWidth,
        y: 0,
        width: CANVAS_WIDTH - halfWidth,
        height: CANVAS_HEIGHT
      },
      action: {
        type: 'message',
        text: targets.query.text
      }
    }
  ];

  const spec = {
    schemaVersion: 1,
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT
    },
    name,
    chatBarText,
    theme,
    buttons
  };

  // Pre-validate converted object
  const lineObj = toLineRichMenuObject(spec);
  validateLineRichMenuObject(lineObj);

  return spec;
}

/**
 * Converts Menu Spec to official LINE Rich Menu API object
 */
export function toLineRichMenuObject(menuSpec) {
  if (!menuSpec || !menuSpec.canvas || !Array.isArray(menuSpec.buttons)) {
    throw new Error('CONVERT_ERROR: Invalid menuSpec structure');
  }

  return {
    size: {
      width: menuSpec.canvas.width,
      height: menuSpec.canvas.height
    },
    selected: true,
    name: menuSpec.name,
    chatBarText: menuSpec.chatBarText,
    areas: menuSpec.buttons.map((btn) => ({
      bounds: btn.bounds,
      action: btn.action
    }))
  };
}

// Allow CLI execution directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targetPath = path.join(rootDir, '.booking/rich-menu/targets.json');
  if (!fs.existsSync(targetPath)) {
    console.error('Missing targets.json! Please run Ep02-0 discovery first.');
    process.exit(1);
  }
  const targets = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const spec = buildMenuSpec(targets);
  const lineObj = toLineRichMenuObject(spec);

  console.log('--- Menu Spec ---');
  console.log(JSON.stringify(spec, null, 2));
  console.log('\n--- LINE Rich Menu Object ---');
  console.log(JSON.stringify(lineObj, null, 2));
}
