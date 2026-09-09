const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../decision-engine');

function safeItem(overrides = {}) {
  const { keepa: keepaOverrides = {}, ...itemOverrides } = overrides;
  return {
    jan: '4902370542912',
    name: '任天堂 Nintendo Switch ソフト',
    avg: 5_000,
    scannedAt: Date.now(),
    keepaFetchedAt: Date.now(),
    keepa: {
      asin: 'B012345678',
      title: '任天堂 Nintendo Switch ソフト',
      newPrice: 4_000,
      avg90New: 3_800,
      fbaFee: 400,
      referralFeePercentage: 15,
      variableClosingFee: 0,
      amazonPresent: false,
      newOfferCount: 5,
      monthlySold: 35,
      salesRankDrops30: 20,
      ...keepaOverrides,
    },
    ...itemOverrides,
  };
}

test('safe limit satisfies profit, margin and ROI at current and 90-day prices', () => {
  const item = safeItem();
  const guide = engine.canonicalSafeGuide(item);
  assert.equal(guide.safe, 2_070);
  assert.equal(guide.ninetySafe, 2_070);
});

test('green requires all data and profitability gates', () => {
  const item = safeItem();
  const result = engine.evaluate(item, 2_000);
  assert.equal(result.signal, '🟢');
  assert.equal(result.decision.profit, 1_000);
  assert.equal(result.decision.margin, 25);
  assert.equal(result.decision.roi, 50);
});

test('list and detail use one canonical red result when ROI fails', () => {
  const item = safeItem();
  const result = engine.evaluate(item, 2_700);
  assert.equal(result.signal, '🔴');
  assert.equal(result.label, '見送り');
  assert.ok(result.reasons.includes('利益率不足'));
  assert.ok(result.reasons.includes('ROI不足'));
});

test('missing or stale data can never become green', () => {
  const missingFees = safeItem({ keepa: { fbaFee: null } });
  const stale = safeItem({ keepaFetchedAt: Date.now() - 7 * 60 * 60 * 1000 });
  assert.equal(engine.evaluate(missingFees, 1_000).signal, '🔴');
  assert.ok(engine.evaluate(missingFees, 1_000).reasons.includes('実手数料不足'));
  assert.equal(engine.evaluate(stale, 1_000).signal, '🔴');
  assert.ok(engine.evaluate(stale, 1_000).reasons.includes('データ鮮度不足'));
});

test('pack mismatch stops profit calculation and green judgement', () => {
  const item = safeItem({
    name: 'チョコ 1袋',
    keepa: { title: 'チョコ 12袋セット' },
  });
  const result = engine.evaluate(item, 100);
  assert.equal(result.signal, '🔴');
  assert.equal(result.decision, null);
  assert.ok(result.reasons.includes('商品単位/ASIN要確認'));
});

test('monthlySold null falls back to rank drops', () => {
  const item = safeItem({ keepa: { monthlySold: null, salesRankDrops30: 30 } });
  assert.equal(engine.demandLevel(item.keepa), 3);
  assert.equal(engine.evaluate(item, 2_000).signal, '🟢');
});

test('cost above the 90-day-safe guide can never be green', () => {
  const item = safeItem();
  const result = engine.evaluate(item, 2_071);
  assert.equal(result.signal, '🔴');
  assert.ok(result.reasons.includes('安全目安超過'));
});
