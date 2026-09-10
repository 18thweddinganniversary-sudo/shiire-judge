const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../app-core');

test('demand display never contains null, undefined or NaN', () => {
  assert.equal(app.demandText({ monthlySold: null, salesRankDrops30: 12, salesRank: 999 }), 'Rank下降 12回/30日');
  assert.equal(app.demandText({ monthlySold: null, salesRankDrops30: null, salesRank: 999 }), 'ランキング 999位');
  assert.equal(app.demandText({ monthlySold: null, salesRankDrops30: null, salesRank: null }), 'データなし');
  assert.doesNotMatch(app.demandText({ monthlySold: null }), /null|undefined|NaN/);
});

test('demand display ignores stale monthly sales and falls back to rank drops', () => {
  const now = 2_000_000_000_000;
  assert.equal(app.demandText({ monthlySold: 100, monthlySoldUpdatedAt: now - 6 * 60 * 60 * 1000 - 1, salesRankDrops30: 8 }, now), 'Rank下降 8回/30日');
  assert.equal(app.demandText({ monthlySold: 100, monthlySoldUpdatedAt: now, salesRankDrops30: 8 }, now), '100件/月');
});

test('offer count display keeps measured zero and hides missing values', () => {
  assert.equal(app.countText(0, '人'), '0人');
  assert.equal(app.countText(null, '人'), 'データなし');
});

test('money display does not coerce missing data to zero yen', () => {
  assert.equal(app.moneyText(null), '-');
  assert.equal(app.moneyText(undefined), '-');
  assert.equal(app.moneyText(''), '-');
  assert.equal(app.moneyText(0), '0円');
  assert.equal(app.moneyText(3000), '3,000円');
});

test('freshness helper accepts a just-fetched item and rejects an expired item', () => {
  const now = 2_000_000_000_000;
  assert.equal(app.needsKeepaRefresh({ keepaFetchedAt: now, keepa: { productUpdatedAt: now, offersUpdatedAt: now, offersSuccessful: true } }, now), false);
  assert.equal(app.needsKeepaRefresh({ keepaFetchedAt: now - 6 * 60 * 60 * 1000 - 1 }, now), true);
  assert.equal(app.needsKeepaRefresh({ keepaFetchedAt: now, keepa: { productUpdatedAt: now, offersUpdatedAt: now, offersSuccessful: false } }, now), true);
});

test('refresh disposition never reopens a sheet the user closed or replaced', () => {
  assert.equal(app.refreshDisposition(null, null, false, true), 'open');
  assert.equal(app.refreshDisposition('4901', null, false, true), 'none');
  assert.equal(app.refreshDisposition('4901', '4901', true, true), 'refresh');
  assert.equal(app.refreshDisposition('4901', '4902', true, true), 'none');
});

test('money formatting preserves digits and a meaningful caret through edits', () => {
  assert.deepEqual(app.formatMoneyInput('500', 3), { text: '500', caret: 3, value: 500 });
  assert.deepEqual(app.formatMoneyInput('3000', 4), { text: '3,000', caret: 5, value: 3000 });
  assert.deepEqual(app.formatMoneyInput('10000', 5), { text: '10,000', caret: 6, value: 10000 });
  assert.deepEqual(app.formatMoneyInput('3,000', 1), { text: '3,000', caret: 1, value: 3000 });
  assert.deepEqual(app.formatMoneyInput('3,000', 2), { text: '3,000', caret: 2, value: 3000 });
  assert.deepEqual(app.formatMoneyInput('10,000', 3), { text: '10,000', caret: 3, value: 10000 });
  assert.deepEqual(app.formatMoneyInput('30,00', 2), { text: '3,000', caret: 3, value: 3000 });
});

test('stored items survive normalization with price and Keepa timestamp intact', () => {
  const raw = JSON.stringify([{ jan: '4902370542912', cost: 3000, keepaFetchedAt: 123, keepa: { asin: 'B012345678' } }]);
  const [item] = app.loadItems(raw);
  assert.equal(item.cost, 3000);
  assert.equal(item.keepaFetchedAt, 123);
  assert.equal(item.keepa.asin, 'B012345678');
});

test('storage recovery tolerates broken JSON and caps history at 30 entries', () => {
  assert.deepEqual(app.loadItems('{broken json'), []);
  assert.deepEqual(app.loadItems('{"items":[]}'), []);
  const items = Array.from({ length: 35 }, (_, index) => ({
    jan: String(4900000000000 + index),
    name: `item-${index}`,
    cost: index + 1,
    keepaFetchedAt: 2_000_000_000_000 + index,
    keepa: { asin: `B${String(index).padStart(9, '0')}` },
  }));
  const loaded = app.loadItems(JSON.stringify(items));
  assert.equal(loaded.length, 30);
  assert.equal(loaded[0].name, 'item-0');
  assert.equal(loaded[29].name, 'item-29');
});
