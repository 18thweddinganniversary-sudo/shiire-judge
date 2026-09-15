const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/keepa');

function responseCapture() {
  let statusCode = null;
  let body = null;
  return {
    res: { status(code) { statusCode = code; return this; }, json(value) { body = value; return value; } },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

function keepaPayload() {
  const current = Array(36).fill(-1);
  const avg90 = Array(36).fill(-1);
  current[1] = 6697;
  current[3] = 12345;
  current[11] = 4;
  avg90[1] = 6500;
  return {
    tokensLeft: 99, tokensConsumed: 1, refillRate: 1, refillIn: 30000, tokenFlowReduction: 0,
    products: [{
      asin: 'B012345678', eanList: ['4902370542912'], monthlySold: null,
      lastUpdate: 8_000_000, lastSoldUpdate: 0, referralFeePercentage: 10,
      fbaFees: { pickAndPackFee: 900, pickAndPackFeeTax: 90 },
      stats: { current, avg90, salesRankDrops30: 12, lastOffersUpdate: 8_000_001 },
    }],
  };
}

test('normal Keepa lookup is low-cost: no marketplace offer pages', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  process.env.KEEPA_API_KEY = 'test-key';
  let requestedUrl = '';
  global.fetch = async (url) => { requestedUrl = String(url); return { ok: true, json: async () => keepaPayload() }; };
  const out = responseCapture();
  try { await handler({ query: { jan: '4902370542912' } }, out.res); }
  finally { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.KEEPA_API_KEY; else process.env.KEEPA_API_KEY = originalKey; }
  const url = new URL(requestedUrl);
  assert.equal(out.statusCode, 200);
  assert.equal(url.searchParams.get('update'), '1');
  assert.equal(url.searchParams.has('offers'), false);
  assert.equal(out.body.tokensConsumed, 1);
  assert.equal(out.body.product.salesRankDrops30, 12);
  assert.equal(out.body.product.fbaFee, 900);
  assert.equal(out.body.product.fbaFeeStatus, 'available_tax_inclusive');
  assert.equal('signal' in out.body.product, false);
});

test('explicit offer refresh may request live offer pages', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  process.env.KEEPA_API_KEY = 'test-key';
  let requestedUrl = '';
  process.env.KEEPA_API_KEY = 'test-key';
  global.fetch = async (url) => { requestedUrl = String(url); const data = keepaPayload(); data.tokensConsumed = 13; data.products[0].offersSuccessful = true; return { ok: true, json: async () => data }; };
  const out = responseCapture();
  try { await handler({ query: { jan: '4902370542912', mode: 'offers' } }, out.res); }
  finally { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.KEEPA_API_KEY; else process.env.KEEPA_API_KEY = originalKey; }
  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get('offers'), '20');
  assert.equal(out.body.tokensConsumed, 13);
});

test('Keepa API rejects ambiguous or non-matching code results', async () => {
  const originalFetch = global.fetch; const originalKey = process.env.KEEPA_API_KEY; process.env.KEEPA_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: true, json: async () => ({ products: [
    { asin: 'B000000001', eanList: ['4902370542912'] }, { asin: 'B000000002', gtinList: ['4902370542912'] },
  ] }) });
  const out = responseCapture();
  try { await handler({ query: { jan: '4902370542912' } }, out.res); }
  finally { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.KEEPA_API_KEY; else process.env.KEEPA_API_KEY = originalKey; }
  assert.equal(out.body.found, false); assert.equal(out.body.reason, 'ambiguous_product_code');
});

test('Keepa API rejects a single product whose returned JAN does not match', async () => {
  const originalFetch = global.fetch; const originalKey = process.env.KEEPA_API_KEY; process.env.KEEPA_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: true, json: async () => ({ products: [{ asin: 'B000000003', eanList: ['4900000000000'] }] }) });
  const out = responseCapture();
  try { await handler({ query: { jan: '4902370542912' } }, out.res); }
  finally { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.KEEPA_API_KEY; else process.env.KEEPA_API_KEY = originalKey; }
  assert.equal(out.body.found, false); assert.equal(out.body.reason, 'product_code_mismatch');
});
