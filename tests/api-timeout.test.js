const test = require('node:test');
const assert = require('node:assert/strict');

const keepa = require('../api/keepa');
const product = require('../api/product');
const related = require('../api/related');

function responseCapture() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return value; },
  };
}

test('upstream timeouts return 504 instead of leaving an API request hanging', async () => {
  const originalFetch = global.fetch;
  const originalKeepaKey = process.env.KEEPA_API_KEY;
  const originalYahooKey = process.env.YAHOO_APP_ID;
  process.env.KEEPA_API_KEY = 'test-key';
  process.env.YAHOO_APP_ID = 'test-app-id';
  global.fetch = async (_url, options) => {
    assert.ok(options.signal, 'each upstream request must have an abort signal');
    const error = new Error('upstream timed out');
    error.name = 'TimeoutError';
    throw error;
  };

  try {
    const cases = [
      [keepa, { query: { jan: '4902370542912' } }, 'keepa_api_timeout'],
      [product, { query: { jan: '4902370542912' } }, 'product_api_timeout'],
      [related, { query: { jan: '4902370542912', brand: '任天堂', name: 'Nintendo Switch' } }, 'related_api_timeout'],
    ];
    for (const [handler, request, expectedError] of cases) {
      const res = responseCapture();
      await handler(request, res);
      assert.equal(res.statusCode, 504);
      assert.equal(res.body.error, expectedError);
    }
  } finally {
    global.fetch = originalFetch;
    if (originalKeepaKey === undefined) delete process.env.KEEPA_API_KEY;
    else process.env.KEEPA_API_KEY = originalKeepaKey;
    if (originalYahooKey === undefined) delete process.env.YAHOO_APP_ID;
    else process.env.YAHOO_APP_ID = originalYahooKey;
  }
});

test('unexpected upstream failures remain controlled JSON errors', async () => {
  const originalFetch = global.fetch;
  const originalKeepaKey = process.env.KEEPA_API_KEY;
  const originalYahooKey = process.env.YAHOO_APP_ID;
  process.env.KEEPA_API_KEY = 'test-key';
  process.env.YAHOO_APP_ID = 'test-app-id';
  global.fetch = async () => { throw new Error('network down'); };
  try {
    const cases = [
      [keepa, { query: { jan: '4902370542912' } }, 'keepa_api_failed'],
      [product, { query: { jan: '4902370542912' } }, 'product_api_failed'],
      [related, { query: { jan: '4902370542912', brand: '任天堂', name: 'Nintendo Switch' } }, 'related_api_failed'],
    ];
    for (const [handler, request, expectedError] of cases) {
      const res = responseCapture();
      await handler(request, res);
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.error, expectedError);
    }
  } finally {
    global.fetch = originalFetch;
    if (originalKeepaKey === undefined) delete process.env.KEEPA_API_KEY;
    else process.env.KEEPA_API_KEY = originalKeepaKey;
    if (originalYahooKey === undefined) delete process.env.YAHOO_APP_ID;
    else process.env.YAHOO_APP_ID = originalYahooKey;
  }
});
