const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/keepa');

test('Keepa API requests fresh live offers and returns raw parsed data only', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  process.env.KEEPA_API_KEY = 'test-key';
  let requestedUrl = '';
  global.fetch = async (url) => {
    requestedUrl = String(url);
    const current = Array(36).fill(-1);
    const avg90 = Array(36).fill(-1);
    current[1] = 6697;
    current[3] = 12345;
    current[11] = 4;
    avg90[1] = 6500;
    return {
      ok: true,
      json: async () => ({
        tokensLeft: 99,
        products: [{
          asin: 'B012345678',
          eanList: ['4902370542912'],
          monthlySold: null,
          lastUpdate: 8_000_000,
          lastSoldUpdate: 0,
          offersSuccessful: true,
          referralFeePercentage: 10,
          fbaFees: { pickAndPackFee: 900, pickAndPackFeeTax: 90 },
          stats: { current, avg90, salesRankDrops30: 12, lastOffersUpdate: 8_000_001 },
        }],
      }),
    };
  };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return value; },
  };
  try {
    await handler({ query: { jan: '4902370542912' } }, res);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KEEPA_API_KEY;
    else process.env.KEEPA_API_KEY = originalKey;
  }
  const url = new URL(requestedUrl);
  assert.equal(statusCode, 200);
  assert.equal(url.searchParams.get('update'), '1');
  assert.equal(url.searchParams.get('offers'), '20');
  assert.equal(url.searchParams.has('only-live-offers'), false);
  assert.equal(body.product.salesRankDrops30, 12);
  assert.equal(body.product.fbaFee, 990);
  assert.equal(body.product.fbaFeeStatus, 'available');
  assert.deepEqual(body.product.fbaFeeComponents, { pickAndPackFee: 900, pickAndPackFeeTax: 90 });
  assert.equal('signal' in body.product, false);
  assert.equal('label' in body.product, false);
});

test('Keepa API rejects ambiguous or non-matching code results', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  process.env.KEEPA_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: true, json: async () => ({ products: [
    { asin: 'B000000001', eanList: ['4902370542912'] },
    { asin: 'B000000002', gtinList: ['4902370542912'] },
  ] }) });
  let body;
  const res = { status() { return this; }, json(value) { body = value; return value; } };
  try {
    await handler({ query: { jan: '4902370542912' } }, res);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KEEPA_API_KEY;
    else process.env.KEEPA_API_KEY = originalKey;
  }
  assert.equal(body.found, false);
  assert.equal(body.reason, 'ambiguous_product_code');
});
