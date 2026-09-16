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
