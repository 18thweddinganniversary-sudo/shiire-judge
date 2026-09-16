'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../sedori-go-core');

test('shortlist keeps only store-usable candidates and preserves support-first wording', () => {
  const details = [
    { asin:'B000000001', found:true, jan:'4901234567894', title:'A', preliminarySafeLimit:1500, newPrice:3000, avg90New:3100, newOfferCount:3, monthlySold:50 },
    { asin:'B000000002', found:true, jan:null, title:'B', preliminarySafeLimit:1600 },
    { asin:'B000000003', found:true, jan:'4901234567801', title:'C', preliminarySafeLimit:null },
  ];
  const out = S.buildShortlist(details);
  assert.equal(out.length, 1);
  assert.equal(out[0].jan, '4901234567894');
  assert.equal(out[0].actionLabel, '店頭で確認');
  assert.equal(out[0].decisionLabel, '仕入れ候補');
  assert.equal(out[0].needsStoreVerification, true);
});

test('candidate cache is valid only within six hours', () => {
  const now = Date.UTC(2026, 8, 16, 8, 0, 0);
  assert.equal(S.isFreshCandidateCache({ savedAt: now - 6*60*60*1000 + 1, shortlist: [] }, now), true);
  assert.equal(S.isFreshCandidateCache({ savedAt: now - 6*60*60*1000 - 1, shortlist: [] }, now), false);
  assert.equal(S.isFreshCandidateCache(null, now), false);
});
