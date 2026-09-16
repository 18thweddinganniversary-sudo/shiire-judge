(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SedoriCandidates = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const FINDER_CONFIG = Object.freeze({
    page: 0,
    perPage: 50,
    minMonthlySold: 30,
    productType: 0,
    availabilityAmazon: Object.freeze([-1]),
  });

  function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeCandidateQuery(input = {}) {
    const rootCategory = positiveInteger(input.rootCategory);
    return {
      page: FINDER_CONFIG.page,
      perPage: Math.min(FINDER_CONFIG.perPage, positiveInteger(input.perPage) || FINDER_CONFIG.perPage),
      rootCategory,
    };
  }

  function buildFinderSelection(options = {}) {
    const normalized = normalizeCandidateQuery(options);
    const selection = {
      page: FINDER_CONFIG.page,
      perPage: normalized.perPage,
      productType: FINDER_CONFIG.productType,
      availabilityAmazon: [...FINDER_CONFIG.availabilityAmazon],
      monthlySold_gte: FINDER_CONFIG.minMonthlySold,
      sort: [['monthlySold', 'desc']],
    };
    if (normalized.rootCategory) selection.rootCategory = [normalized.rootCategory];
    return selection;
  }

  function estimateFinderTokenFloor(resultCount) {
    const count = Number(resultCount);
    const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    return 10 + Math.ceil(safeCount / 100);
  }

  return { FINDER_CONFIG, normalizeCandidateQuery, buildFinderSelection, estimateFinderTokenFloor };
});
