'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('detail sheet loads purchase record modules and user-result controls', () => {
  assert.match(html, /purchase-record-core\.js/);
  assert.match(html, /purchase-record-ui\.js/);
  assert.match(html, /id="purchaseBought"[^>]*>買った</);
  assert.match(html, /id="purchaseSkipped"[^>]*>見送った</);
  assert.match(html, /id="purchaseRecordStatus"/);
});

test('purchase result UI remains separate from the canonical verdict section', () => {
  const verdictAt = html.indexOf('id="verdict"');
  const purchaseAt = html.indexOf('id="purchaseResult"');
  assert.ok(verdictAt >= 0);
  assert.ok(purchaseAt > verdictAt);
});
