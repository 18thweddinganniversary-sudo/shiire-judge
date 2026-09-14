const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/product');

async function runWithHits(hits) {
  const originalFetch = global.fetch;
  const originalKey = process.env.YAHOO_APP_ID;
  process.env.YAHOO_APP_ID = 'test-app-id';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ totalResultsAvailable: hits.length, hits }),
  });
  let statusCode;
  let body;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return value; },
  };
  try {
    await handler({ query: { jan: '4902370542912' } }, res);
    return { statusCode, body };
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.YAHOO_APP_ID;
    else process.env.YAHOO_APP_ID = originalKey;
  }
}

test('product metadata ignores used or incomplete listings for a new-item decision', async () => {
  const result = await runWithHits([
    { name: '【中古】Nintendo Switch 本体のみ 箱なし', price: 12000 },
    { name: 'Nintendo Switch 本体 ネオンブルー・ネオンレッド', price: 32978, brand: { name: '任天堂' } },
  ]);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.found, true);
  assert.equal(result.body.name, 'Nintendo Switch 本体 ネオンブルー・ネオンレッド');
  assert.equal(result.body.avg, 32978);
});

test('product metadata refuses to identify an item from used listings only', async () => {
  const result = await runWithHits([
    { name: 'ジャンク Nintendo Switch 動作未確認', price: 5000 },
    { name: '中古 Nintendo Switch 欠品あり', price: 10000 },
  ]);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.found, false);
  assert.equal(result.body.reason, 'only_used_or_incomplete_listings');
});
