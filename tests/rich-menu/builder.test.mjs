import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMenuSpec,
  toLineRichMenuObject,
  validateLineRichMenuObject,
  CANVAS_WIDTH,
  CANVAS_HEIGHT
} from '../../scripts/rich-menu/builder.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const mockTargets = {
  station: { name: '高雄服務站' },
  booking: {
    type: 'uri',
    target: 'https://liff.line.me/2011709076-09FdfkjH'
  },
  query: {
    type: 'message',
    text: '查詢預約'
  }
};

test('Ep02-1 Spec Builder & LINE Object Validator Test Suite', async (t) => {
  await t.test('1. should calculate deterministic 2500x1686 geometry without bounds overflow', () => {
    const spec = buildMenuSpec(mockTargets);

    assert.equal(spec.canvas.width, CANVAS_WIDTH);
    assert.equal(spec.canvas.height, CANVAS_HEIGHT);
    assert.equal(spec.buttons.length, 2);

    const [left, right] = spec.buttons;

    // Left button bounds
    assert.equal(left.bounds.x, 0);
    assert.equal(left.bounds.y, 0);
    assert.equal(left.bounds.width, 1250);
    assert.equal(left.bounds.height, 1686);
    assert.equal(left.action.type, 'uri');
    assert.equal(left.action.uri, mockTargets.booking.target);

    // Right button bounds
    assert.equal(right.bounds.x, 1250);
    assert.equal(right.bounds.y, 0);
    assert.equal(right.bounds.width, 1250);
    assert.equal(right.bounds.height, 1686);
    assert.equal(right.action.type, 'message');
    assert.equal(right.action.text, mockTargets.query.text);
  });

  await t.test('2. should reject overlapping areas or out-of-boundary bounds', () => {
    // Test out of bounds area
    const outOfBoundsObj = {
      size: { width: 2500, height: 1686 },
      name: 'Test Menu',
      chatBarText: '選單',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2600, height: 1686 }, // 2600 > 2500
          action: { type: 'message', text: 'hi' }
        }
      ]
    };
    assert.throws(
      () => validateLineRichMenuObject(outOfBoundsObj),
      /out of canvas boundary/
    );

    // Test overlapping areas
    const overlappingObj = {
      size: { width: 2500, height: 1686 },
      name: 'Test Menu',
      chatBarText: '選單',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1500, height: 1686 },
          action: { type: 'message', text: 'a' }
        },
        {
          bounds: { x: 1000, y: 0, width: 1500, height: 1686 }, // overlaps with 1000..1500
          action: { type: 'message', text: 'b' }
        }
      ]
    };
    assert.throws(
      () => validateLineRichMenuObject(overlappingObj),
      /bounds overlap/
    );
  });

  await t.test('3. should strictly reject chatBarText exceeding 14 characters', () => {
    // 15 characters
    assert.throws(
      () => buildMenuSpec(mockTargets, { chatBarText: '這是一個超過十四個字的底部選單名稱' }),
      /exceeds maximum length of 14 characters/
    );

    // Valid 14 characters
    const valid14 = buildMenuSpec(mockTargets, { chatBarText: '剛好十四個字元長度的選單名稱' });
    assert.equal(valid14.chatBarText.length, 14);
  });

  await t.test('4. should be 100% deterministic given identical inputs', () => {
    const spec1 = buildMenuSpec(mockTargets);
    const spec2 = buildMenuSpec(mockTargets);

    assert.equal(JSON.stringify(spec1), JSON.stringify(spec2));

    const line1 = toLineRichMenuObject(spec1);
    const line2 = toLineRichMenuObject(spec2);

    assert.equal(JSON.stringify(line1), JSON.stringify(line2));
  });

  await t.test('5. should work with real targets.json produced by Ep02-0', () => {
    const targetPath = path.join(rootDir, '.booking/rich-menu/targets.json');
    assert.ok(fs.existsSync(targetPath));

    const targets = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const spec = buildMenuSpec(targets);
    const lineObj = toLineRichMenuObject(spec);

    assert.equal(validateLineRichMenuObject(lineObj), true);
    assert.equal(lineObj.areas.length, 2);
    assert.equal(lineObj.areas[0].action.uri, targets.booking.target);
    assert.equal(lineObj.areas[1].action.text, targets.query.text);
  });
});
