const assert = require('node:assert/strict');
const test = require('node:test');

test('deployment gate negative probe — intentional failure, never merge', () => {
  assert.fail('INTENTIONAL FAILURE: proves Vercel/GitHub production gate blocks promotion');
});
