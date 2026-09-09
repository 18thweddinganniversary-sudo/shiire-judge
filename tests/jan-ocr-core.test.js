const test = require('node:test');
const assert = require('node:assert/strict');

const jan = require('../jan-ocr-core');

test('accepts a valid JAN and rejects a bad check digit', () => {
  assert.equal(jan.validJan('4902370542912'), true);
  assert.equal(jan.validJan('4902370542913'), false);
});

test('extracts a labelled JAN from OCR text with spaces', () => {
  assert.equal(jan.extractJanFromText('商品 JAN: 4902 3705 42912'), '4902370542912');
});

test('normalizes full-width digits before validation', () => {
  assert.equal(jan.normalizeJan('４９０２３７０５４２９１２'), '4902370542912');
});
