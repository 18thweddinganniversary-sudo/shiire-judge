const test = require('node:test');
const assert = require('node:assert/strict');

const keepaCore = require('../keepa-core');
const engine = require('../decision-engine');

const KEEPA_EPOCH_MS = Date.UTC(2011, 0, 1);

function keepaMinute(now) {
  return Math.floor((now - KEEPA_EPOCH_MS) / 60_000);
}

function rawProduct(now, overrides = {}) {
  const current = Array(36).fill(-1);
  const avg90 = Array(36).fill(-1);
  current[1] = 4_000;
  current[3] = 12_345;
  current[11] = 5;
  avg90[1] = 3_800;
  return {
    asin: 'B012345678',
    title: 'Example household item',
    monthlySold: 35,
    lastSoldUpdate: keepaMinute(now),
    lastUpdate: keepaMinute(now),
    fbaFees: { pickAndPackFee: 400, pickAndPackFeeTax: 40 },
    referralFeePercentage: 15,
    variableClosingFee: null,
    categoryTree: [{ catId: 1, name: 'ドラッグストア' }],
    offersSuccessful: true,
    stats: { current, avg90, salesRankDrops30: 20, lastOffersUpdate: keepaMinute(now) },
    ...overrides,
  };
}

function evaluateRaw(raw, now, cost = 2_000) {
  const parsed = keepaCore.parseProduct(raw);
  return engine.evaluate({
    jan: '4902370542912',
    name: parsed.title,
    avg: 4_000,
    keepaFetchedAt: now,
    keepa: parsed,
  }, cost, { now });
}

test('a complete fresh Keepa response can produce green', () => {
  const now = 2_000_000_000_000;
  const result = evaluateRaw(rawProduct(now), now);
  assert.equal(result.signal, '🟢');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.decision.fees, 1_040);
});

test('FBA tax omission is not silently treated as zero', () => {
  const now = 2_000_000_000_000;
  const raw = rawProduct(now, { fbaFees: { pickAndPackFee: 400 } });
  const parsed = keepaCore.parseProduct(raw);
  const result = evaluateRaw(raw, now);
  assert.equal(parsed.fbaFeeStatus, 'tax_unavailable');
  assert.equal(result.signal, '🔴');
  assert.ok(result.reasons.includes('実手数料不足'));
});

test('a complete Amazon Japan response can produce green with its tax-inclusive FBA fee', () => {
  const now = 2_000_000_000_000;
  const raw = rawProduct(now, {
    domainId: 5,
    fbaFees: { pickAndPackFee: 440 },
  });
  const parsed = keepaCore.parseProduct(raw);
  const result = evaluateRaw(raw, now);
  assert.equal(parsed.fbaFee, 440);
  assert.equal(parsed.fbaFeeStatus, 'available_tax_inclusive');
  assert.equal(result.signal, '🟢');
  assert.equal(result.decision.fees, 1_040);
});

test('media closing fee must be provided while a supplied fee is included', () => {
  const now = 2_000_000_000_000;
  const media = rawProduct(now, {
    categoryTree: [{ catId: 1, name: '本' }],
    variableClosingFee: null,
  });
  assert.equal(evaluateRaw(media, now).signal, '🔴');
  const withFee = evaluateRaw({ ...media, variableClosingFee: 140 }, now, 1_800);
  assert.equal(withFee.signal, '🟢');
  assert.equal(withFee.decision.fees, 1_180);
});
