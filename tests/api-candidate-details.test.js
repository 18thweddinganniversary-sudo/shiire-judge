'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function responseCapture() {
  let statusCode = null;
  let body = null;
  return {
    res: { status(code) { statusCode = code; return this; }, json(value) { body = value; return value; } },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

function product(asin, ean) {
  const current = Array(36).fill(-1);
  const avg90 = Array(36).fill(-1);
  current[1] = 5000;
  current[3] = 12000;
  current[11] = 3;
  avg90[1] = 5000;
  return {
    asin,
    eanList: [ean],
    title: `候補 ${asin} 1個`,
    brand: 'TEST',
    monthlySold: 50,
    lastSoldUpdate: 8_261_700,
    lastUpdate: 8_261_700,
    referralFeePercentage: 10,
    fbaFees: { pickAndPackFee: 500, pickAndPackFeeTax: 50 },
    categoryTree: [{ name: 'ホーム＆キッチン' }],
    stats: { current, avg90, salesRankDrops30: 15, lastOffersUpdate: 8_261_700 },
  };
}

test('candidate detail enrichment is bounded to five ASINs and stays on low-cost product data', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  process.env.KEEPA_API_KEY = 'test-key';
  let requestedUrl = '';
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        tokensConsumed: 2,
        tokensLeft: 40,
        products: [product('B08THGRBZ6', '4901234567894'), product('B08HGZ5XPH', '4901234567801')],
      }),
    };
  };
  const out = responseCapture();
  try {
    const handler = require('../api/candidate-details');
    await handler({ query: { asins: 'B08THGRBZ6,B08HGZ5XPH' } }, out.res);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KEEPA_API_KEY; else process.env.KEEPA_API_KEY = originalKey;
  }

  const url = new URL(requestedUrl);
  assert.equal(out.statusCode, 200);
  assert.equal(url.searchParams.get('history'), '0');
  assert.equal(url.searchParams.get('stats'), '90');
  assert.equal(url.searchParams.has('update'), false);
  assert.equal(url.searchParams.has('offers'), false);
  assert.equal(out.body.tokensConsumed, 2);
  assert.equal(out.body.details.length, 2);
  assert.equal(out.body.details[0].asin, 'B08THGRBZ6');
  assert.equal(out.body.details[0].jan, '4901234567894');
  assert.equal(out.body.details[0].newOfferCount, 3);
  assert.ok(out.body.details[0].preliminarySafeLimit > 0);
  assert.equal(out.body.details[0].needsStoreVerification, true);
});

test('candidate detail enrichment rejects more than five ASINs before Keepa is called', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  process.env.KEEPA_API_KEY = 'test-key';
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error('must not call'); };
  const out = responseCapture();
  try {
    const handler = require('../api/candidate-details');
    await handler({ query: { asins: 'B000000001,B000000002,B000000003,B000000004,B000000005,B000000006' } }, out.res);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KEEPA_API_KEY; else process.env.KEEPA_API_KEY = originalKey;
  }
  assert.equal(out.statusCode, 400);
  assert.equal(out.body.error, 'candidate_batch_too_large');
  assert.equal(calls, 0);
});
