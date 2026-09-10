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
      offersUpdatedAt: Date.now(),
      offersSuccessful: true,
      productUpdatedAt: Date.now(),
      monthlySoldUpdatedAt: Date.now(),
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

test('multi-stage and explicit pack totals cannot produce a false green', () => {
  const sixty = safeItem({
    name: '缶コーヒー 185ml 2箱 計60缶',
    keepa: { title: '缶コーヒー 185ml 2箱 計90缶' },
  });
  const staged = safeItem({
    name: '飲料 185ml 6本×5パック×3箱',
    keepa: { title: '飲料 185ml 6本×3箱' },
  });
  assert.equal(engine.evaluate(sixty, 100).signal, '🔴');
  assert.ok(engine.evaluate(sixty, 100).reasons.includes('商品単位/ASIN要確認'));
  assert.equal(engine.evaluate(staged, 100).signal, '🔴');
});

test('ambiguous food packaging cannot produce a false green', () => {
  const item = safeItem({ name: 'Example コーヒー 10袋', keepa: { title: 'Example コーヒー 10袋' } });
  assert.equal(engine.evaluate(item, 100).signal, '🔴');
  assert.ok(engine.evaluate(item, 100).reasons.includes('商品単位/ASIN要確認'));
});

test('monthlySold null falls back to rank drops', () => {
  const item = safeItem({ keepa: { monthlySold: null, salesRankDrops30: 30 } });
  assert.equal(engine.demandLevel(item.keepa), 3);
  assert.equal(engine.evaluate(item, 2_000).signal, '🟢');
});

test('missing demand is distinct from measured low demand', () => {
  const missing = safeItem({ keepa: { monthlySold: null, salesRankDrops30: null, salesRank: 12345 } });
  const low = safeItem({ keepa: { monthlySold: null, salesRankDrops30: 0, salesRank: 12345 } });
  assert.equal(engine.demandLevel(missing.keepa), null);
  assert.ok(engine.evaluate(missing, 2_000).reasons.includes('回転データ不足'));
  assert.doesNotMatch(engine.evaluate(missing, 2_000).reasons.join(','), /回転不足/);
  assert.equal(engine.demandLevel(low.keepa), 0);
  assert.ok(engine.evaluate(low, 2_000).reasons.includes('回転不足'));
});

test('a new Keepa fetch timestamp is fresh and a future or expired timestamp is not', () => {
  const now = 2_000_000_000_000;
  const fresh = safeItem({ keepaFetchedAt: now });
  const future = safeItem({ keepaFetchedAt: now + 61_000 });
  assert.equal(engine.evaluate(fresh, 2_000, { now }).reasons.includes('データ鮮度不足'), false);
  assert.equal(engine.evaluate(future, 2_000, { now }).reasons.includes('データ鮮度不足'), true);
});

test('missing or stale underlying offer data cannot become green', () => {
  const now = 2_000_000_000_000;
  const missing = safeItem({ keepaFetchedAt: now, keepa: { offersUpdatedAt: null } });
  const stale = safeItem({ keepaFetchedAt: now, keepa: { offersUpdatedAt: now - 6 * 60 * 60 * 1000 - 1 } });
  const failed = safeItem({ keepaFetchedAt: now, keepa: { offersUpdatedAt: now, offersSuccessful: false } });
  assert.ok(engine.evaluate(missing, 2_000, { now }).reasons.includes('出品者データ鮮度不足'));
  assert.ok(engine.evaluate(stale, 2_000, { now }).reasons.includes('出品者データ鮮度不足'));
  assert.ok(engine.evaluate(failed, 2_000, { now }).reasons.includes('出品者データ鮮度不足'));
});

test('missing closing fee or stale product data cannot become green', () => {
  const now = 2_000_000_000_000;
  const missingClosing = safeItem({ keepa: { variableClosingFee: null } });
  const staleProduct = safeItem({ keepaFetchedAt: now, keepa: {
    productUpdatedAt: now - 6 * 60 * 60 * 1000 - 1,
    offersUpdatedAt: now,
    monthlySoldUpdatedAt: now,
  } });
  assert.ok(engine.evaluate(missingClosing, 2_000).reasons.includes('実手数料不足'));
  assert.equal(engine.evaluate(missingClosing, 2_000).signal, '🔴');
  assert.equal(engine.evaluate(missingClosing, 2_000).reasons.includes('仕入れ価格未入力'), false);
  assert.ok(engine.evaluate(staleProduct, 2_000, { now }).reasons.includes('商品データ鮮度不足'));
});

test('missing closing fee is zero only for an explicitly non-applicable category', () => {
  const nonApplicable = safeItem({ keepa: {
    variableClosingFee: null,
    variableClosingFeeApplicable: false,
  } });
  const applicable = safeItem({ keepa: {
    variableClosingFee: null,
    variableClosingFeeApplicable: true,
  } });
  assert.equal(engine.calculateDecision(nonApplicable, 2_000).fees, 1_000);
  assert.equal(engine.evaluate(nonApplicable, 2_000).signal, '🟢');
  assert.equal(engine.calculateDecision(applicable, 2_000), null);
  assert.ok(engine.evaluate(applicable, 2_000).reasons.includes('実手数料不足'));
});

test('stale monthlySold falls back to fresh sales-rank drops', () => {
  const now = 2_000_000_000_000;
  const keepa = {
    monthlySold: 100,
    monthlySoldUpdatedAt: now - 6 * 60 * 60 * 1000 - 1,
    salesRankDrops30: 4,
  };
  assert.equal(engine.demandLevel(keepa, now), 1);
});

test('profit arithmetic includes referral, FBA, variable closing and other costs', () => {
  const item = safeItem({
    keepa: {
      newPrice: 6_697,
      avg90New: 6_697,
      fbaFee: 1_000,
      referralFeePercentage: 10,
      variableClosingFee: 200,
    },
  });
  const decision = engine.calculateDecision(item, 3_000, { otherCost: 184 });
  assert.deepEqual(decision, {
    cost: 3_000,
    sale: 6_697,
    fees: 2_054,
    profit: 1_643,
    margin: 24.53,
    roi: 54.77,
  });
});

test('current and 90-day limits use the same other-cost calculation as the verdict', () => {
  const item = safeItem();
  const withoutOther = engine.canonicalSafeGuide(item);
  const withOther = engine.canonicalSafeGuide(item, { otherCost: 200 });
  assert.equal(withOther.currentSafe, withoutOther.currentSafe - 200);
  assert.equal(withOther.ninetySafe, withoutOther.ninetySafe - 200);
  const result = engine.evaluate(item, withOther.safe + 1, { otherCost: 200 });
  assert.ok(result.reasons.includes('利益条件上限超過'));
});

test('profit-only guide never overrides a failed demand gate', () => {
  const item = safeItem({ keepa: { monthlySold: 0, salesRankDrops30: 0 } });
  const result = engine.evaluate(item, 1_000);
  assert.ok(result.guide.safe > 1_000);
  assert.equal(result.signal, '🔴');
  assert.ok(result.reasons.includes('回転不足'));
});

test('cost above the 90-day-safe guide can never be green', () => {
  const item = safeItem();
  const result = engine.evaluate(item, 2_071);
  assert.equal(result.signal, '🔴');
  assert.ok(result.reasons.includes('利益条件上限超過'));
});
