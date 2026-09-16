'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/candidates');

function responseCapture() {
  let statusCode = null;
  let body = null;
  return {
    res: { status(code) { statusCode = code; return this; }, json(value) { body = value; return value; } },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

async function withKeepa(fetchImpl, run) {
  const originalFetch = global.fetch;
  const originalKey = process.env.KEEPA_API_KEY;
  process.env.KEEPA_API_KEY = 'secret-test-key';
  global.fetch = fetchImpl;
  try { await run(); }
  finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KEEPA_API_KEY;
    else process.env.KEEPA_API_KEY = originalKey;
  }
}

test('candidate endpoint performs one bounded Japan Product Finder request without stats', async () => {
  const requested = [];
  const out = responseCapture();
  await withKeepa(async (url, options) => {
    requested.push({ url: String(url), options });
    return { ok: true, status: 200, json: async () => ({
      asinList: ['B000000001', 'B000000002'], totalResults: 2,
      tokensConsumed: 11, tokensLeft: 49, refillRate: 1,
    }) };
  }, async () => handler({ query: {} }, out.res));

  assert.equal(out.statusCode, 200);
  assert.equal(requested.length, 1);
  const url = new URL(requested[0].url);
  assert.equal(url.origin + url.pathname, 'https://api.keepa.com/query');
  assert.equal(url.searchParams.get('domain'), '5');
  assert.equal(url.searchParams.has('stats'), false);
  assert.equal(url.searchParams.get('key'), 'secret-test-key');
  const selection = JSON.parse(url.searchParams.get('selection'));
  assert.equal(selection.page, 0);
  assert.equal(selection.perPage, 50);
  assert.deepEqual(selection.availabilityAmazon, [-1]);
  assert.equal(out.body.ok, true);
  assert.deepEqual(out.body.candidates, ['B000000001', 'B000000002']);
  assert.equal(out.body.tokensConsumed, 11);
  assert.equal(JSON.stringify(out.body).includes('secret-test-key'), false);
});

test('candidate endpoint ignores caller attempts to page or increase result size', async () => {
  let requestedUrl = '';
  const out = responseCapture();
  await withKeepa(async (url) => {
    requestedUrl = String(url);
    return { ok: true, status: 200, json: async () => ({ asinList: [], totalResults: 0, tokensConsumed: 10, tokensLeft: 50, refillRate: 1 }) };
  }, async () => handler({ query: { page: '9', perPage: '10000' } }, out.res));

  const selection = JSON.parse(new URL(requestedUrl).searchParams.get('selection'));
  assert.equal(selection.page, 0);
  assert.equal(selection.perPage, 50);
});

test('candidate endpoint preserves Keepa 429 as token_limit', async () => {
  const out = responseCapture();
  await withKeepa(async () => ({ ok: false, status: 429, json: async () => ({ tokensLeft: 0, tokensConsumed: 0, refillRate: 1, error: { message: 'not enough tokens' } }) }),
    async () => handler({ query: {} }, out.res));

  assert.equal(out.statusCode, 429);
  assert.equal(out.body.ok, false);
  assert.equal(out.body.error, 'token_limit');
  assert.equal(out.body.tokensLeft, 0);
});

test('candidate endpoint does not treat malformed successful response as empty success', async () => {
  const out = responseCapture();
  await withKeepa(async () => ({ ok: true, status: 200, json: async () => ({ tokensConsumed: 10, tokensLeft: 40, refillRate: 1 }) }),
    async () => handler({ query: {} }, out.res));

  assert.equal(out.statusCode, 502);
  assert.equal(out.body.ok, false);
  assert.equal(out.body.error, 'keepa_candidate_response_invalid');
});
