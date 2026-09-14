const test = require('node:test');
const assert = require('node:assert/strict');

const keepa = require('../keepa-core');

function product(overrides = {}) {
  const current = Array(36).fill(-1);
  const avg90 = Array(36).fill(-1);
  current[0] = -1;
  current[1] = 6697;
  current[3] = 12345;
  current[11] = 5;
  current[18] = 6700;
  avg90[1] = 6500;
  return {
    asin: 'B012345678',
    title: 'Example',
    brand: 'Example',
    monthlySold: null,
    lastSoldUpdate: 0,
    lastUpdate: 8_000_000,
    fbaFees: { pickAndPackFee: 900, pickAndPackFeeTax: 90 },
    referralFeePercentage: 10,
    offersSuccessful: true,
    variableClosingFee: 80,
    stats: { current, avg90, salesRankDrops30: null, lastOffersUpdate: 8_000_001 },
    ...overrides,
  };
}

test('strict nullable values never coerce null, blank or -1 to zero', () => {
  assert.equal(keepa.value(null), null);
  assert.equal(keepa.value(undefined), null);
  assert.equal(keepa.value(''), null);
  assert.equal(keepa.value(-1), null);
  assert.equal(keepa.value(0), 0);
});

test('Keepa fields use official CSV indexes and preserve missing demand', () => {
  const parsed = keepa.parseProduct(product());
  assert.equal(parsed.newPrice, 6697);
  assert.equal(parsed.avg90New, 6500);
  assert.equal(parsed.newOfferCount, 5);
  assert.equal(parsed.salesRank, 12345);
  assert.equal(parsed.monthlySold, null);
  assert.equal(parsed.salesRankDrops30, null);
  assert.equal(parsed.fbaFee, 990);
  assert.equal(parsed.fbaFeeStatus, 'available');
  assert.deepEqual(parsed.fbaFeeComponents, { pickAndPackFee: 900, pickAndPackFeeTax: 90 });
  assert.equal(parsed.referralFeePercentage, 10);
  assert.equal(parsed.variableClosingFee, 80);
  assert.equal(parsed.offersSuccessful, true);
  assert.equal('signal' in parsed, false);
  assert.equal('label' in parsed, false);
});

test('sales-rank drops zero is measured data while -1 is missing', () => {
  assert.equal(keepa.parseProduct(product({ stats: { ...product().stats, salesRankDrops30: 0 } })).salesRankDrops30, 0);
  assert.equal(keepa.parseProduct(product({ stats: { ...product().stats, salesRankDrops30: -1 } })).salesRankDrops30, null);
});

test('zero FBA fee is treated as unavailable because Keepa uses it for invalid dimensions', () => {
  const parsed = keepa.parseProduct(product({ fbaFees: { pickAndPackFee: 0, pickAndPackFeeTax: 0 } }));
  assert.equal(parsed.fbaFee, null);
  assert.equal(parsed.fbaFeeStatus, 'invalid_dimensions');
});

test('missing FBA tax remains unavailable instead of being coerced to zero', () => {
  const parsed = keepa.parseProduct(product({ fbaFees: { pickAndPackFee: 900 } }));
  assert.equal(parsed.fbaFee, null);
  assert.equal(parsed.fbaFeeStatus, 'tax_unavailable');
  assert.deepEqual(parsed.fbaFeeComponents, { pickAndPackFee: 900, pickAndPackFeeTax: null });
});

test('Amazon Japan uses the published tax-inclusive pick-and-pack fee when tax field is absent', () => {
  const parsed = keepa.parseProduct(product({
    domainId: 5,
    fbaFees: { pickAndPackFee: 472 },
  }));
  assert.equal(parsed.fbaFee, 472);
  assert.equal(parsed.fbaFeeStatus, 'available_tax_inclusive');
  assert.deepEqual(parsed.fbaFeeComponents, { pickAndPackFee: 472, pickAndPackFeeTax: null });
});

test('Amazon Japan never adds a separate tax field to its tax-inclusive pick-and-pack fee', () => {
  const parsed = keepa.parseProduct(product({
    domainId: 5,
    fbaFees: { pickAndPackFee: 472, pickAndPackFeeTax: 47 },
  }));
  assert.equal(parsed.fbaFee, 472);
  assert.equal(parsed.fbaFeeStatus, 'available_tax_inclusive');
});

test('missing Keepa FBA object is distinguishable from a parser failure', () => {
  const parsed = keepa.parseProduct(product({ fbaFees: null }));
  assert.equal(parsed.fbaFee, null);
  assert.equal(parsed.fbaFeeStatus, 'not_collected');
  assert.equal(parsed.fbaFeeComponents, null);
});

test('closing-fee applicability is derived only from Keepa category evidence', () => {
  const grocery = keepa.parseProduct(product({
    variableClosingFee: null,
    categoryTree: [{ catId: 123, name: '食品・飲料・お酒' }, { catId: 456, name: 'コーヒー' }],
  }));
  const book = keepa.parseProduct(product({
    variableClosingFee: null,
    categoryTree: [{ catId: 123, name: '本' }],
  }));
  const unknown = keepa.parseProduct(product({ variableClosingFee: null, categoryTree: null }));
  assert.equal(grocery.variableClosingFeeApplicable, false);
  assert.equal(book.variableClosingFeeApplicable, true);
  assert.equal(unknown.variableClosingFeeApplicable, null);
  assert.deepEqual(grocery.categoryPath, ['食品・飲料・お酒', 'コーヒー']);
});
