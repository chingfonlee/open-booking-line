import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderMenuImage, generateMenuSvg, CANVAS_WIDTH, CANVAS_HEIGHT, MAX_FILE_SIZE } from '../../scripts/rich-menu/renderer.mjs';
import { buildMenuSpec } from '../../scripts/rich-menu/builder.mjs';

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

test('Ep02-2 Deterministic Renderer Test Suite', async (t) => {
  const spec = buildMenuSpec(mockTargets);

  await t.test('1. should generate valid SVG containing accurate Chinese text and branding', () => {
    const svg = generateMenuSvg(spec);

    assert.ok(svg.includes('高雄服務站'));
    assert.ok(svg.includes('線上預約'));
    assert.ok(svg.includes('查詢進度'));
    assert.ok(svg.includes(`viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"`));
  });

  await t.test('2. should render exact 2500x1686 dimensions with sharp metadata validation', async () => {
    const { buffer, dimensions, sizeBytes } = await renderMenuImage(spec);

    assert.equal(dimensions.width, CANVAS_WIDTH);
    assert.equal(dimensions.height, CANVAS_HEIGHT);
    assert.ok(sizeBytes <= MAX_FILE_SIZE, `File size ${sizeBytes} exceeds 1MB limit`);

    // Verify raw image metadata through sharp
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, CANVAS_WIDTH);
    assert.equal(metadata.height, CANVAS_HEIGHT);
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.space, 'srgb');
  });

  await t.test('3. should produce 100% deterministic binary image buffer given identical inputs', async () => {
    const res1 = await renderMenuImage(spec);
    const res2 = await renderMenuImage(spec);

    const hash1 = crypto.createHash('sha256').update(res1.buffer).digest('hex');
    const hash2 = crypto.createHash('sha256').update(res2.buffer).digest('hex');

    assert.equal(hash1, hash2, 'Image render must be completely deterministic');
  });

  await t.test('4. should keep file size well below LINE 1MB limit (1,048,576 bytes)', async () => {
    const { sizeBytes } = await renderMenuImage(spec);

    // PNG with vector curves typically achieves ~100KB to 300KB
    assert.ok(sizeBytes < 500000, `Expected < 500KB, got ${sizeBytes}`);
    assert.ok(sizeBytes < MAX_FILE_SIZE);
  });
});
