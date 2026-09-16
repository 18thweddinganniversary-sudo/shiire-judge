'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Candidate = require('../candidate-core');

test('default candidate query is conservative and bounded', () => {
  const options = Candidate.normalizeCandidateQuery({});
  const selection = Candidate.buildFinderSelection(options);

  assert.equal(selection.page, 0);
  assert.equal(selection.perPage, 50);
  assert.equal(selection.productType, 0);
  assert.deepEqual(selection.availabilityAmazon, [-1]);
  assert.equal(selection.monthlySold_gte, 30);
  assert.deepEqual(selection.sort, [['monthlySold', 'desc']]);
  assert.equal(Object.hasOwn(selection, 'stats'), false);
});

test('phase 2 prefilters mirror the existing decision gates before product detail calls', () => {
  const selection = Candidate.buildFinderSelection(Candidate.normalizeCandidateQuery({}));

  assert.equal(selection.current_NEW_gte, 1500);
  assert.equal(selection.avg90_NEW_gte, 1);
  assert.equal(selection.current_COUNT_NEW_gte, 1);
  assert.equal(selection.current_COUNT_NEW_lte, 15);
  assert.equal(selection.deltaPercent90_NEW_gte, -15);
  assert.equal(selection.deltaPercent90_NEW_lte, 25);
});

test('phase 2 candidate prefilter requires fee data and six-hour-fresh product/offer updates', () => {
  const nowMs = Date.UTC(2026, 8, 16, 8, 0, 0);
  const selection = Candidate.buildFinderSelection(Candidate.normalizeCandidateQuery({ nowMs }));
  const expectedFreshAfter = Math.floor(nowMs / 60000) - 21564000 - 360;

  assert.equal(selection.fbaFees_gte, 1);
  assert.equal(selection.lastUpdate_gte, expectedFreshAfter);
  assert.equal(selection.lastOffersUpdate_gte, expectedFreshAfter);
});

test('candidate query never allows more than 50 results or nonzero pages', () => {
  const options = Candidate.normalizeCandidateQuery({ perPage: 500, page: 8 });
  const selection = Candidate.buildFinderSelection(options);

  assert.equal(selection.perPage, 50);
  assert.equal(selection.page, 0);
});

test('optional root category is copied only when explicitly valid', () => {
  const withoutCategory = Candidate.buildFinderSelection(Candidate.normalizeCandidateQuery({}));
  assert.equal(Object.hasOwn(withoutCategory, 'rootCategory'), false);

  const withCategory = Candidate.buildFinderSelection(Candidate.normalizeCandidateQuery({ rootCategory: 2016926051 }));
  assert.deepEqual(withCategory.rootCategory, [2016926051]);
});

test('finder token floor matches Keepa base plus result bands', () => {
  assert.equal(Candidate.estimateFinderTokenFloor(0), 10);
  assert.equal(Candidate.estimateFinderTokenFloor(50), 11);
  assert.equal(Candidate.estimateFinderTokenFloor(100), 11);
  assert.equal(Candidate.estimateFinderTokenFloor(101), 12);
});
