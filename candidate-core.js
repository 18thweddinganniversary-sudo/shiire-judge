(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SedoriCandidates = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KEEPA_EPOCH_MINUTES = 21564000;
  const FRESHNESS_MINUTES = 6 * 60;

  const FINDER_CONFIG = Object.freeze({
    page: 0,
    perPage: 50,
    minMonthlySold: 30,
    minNewPrice: 1500,
    minNewOfferCount: 1,
    maxNewOfferCount: 15,
    minPriceTo90dPercent: -15,
    maxPriceTo90dPercent: 25,
    minFbaFee: 1,
    minSalesRank: 1,
    maxSalesRank: 50000,
    productType: 0,
    availabilityAmazon: Object.freeze([-1]),
  });

  function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeNowMs(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
  }

  function freshAfterKeepaMinute(nowMs) {
    return Math.floor(normalizeNowMs(nowMs) / 60000) - KEEPA_EPOCH_MINUTES - FRESHNESS_MINUTES;
  }

  function normalizeCandidateQuery(input = {}) {
    const rootCategory = positiveInteger(input.rootCategory);
    return {
      page: FINDER_CONFIG.page,
      perPage: Math.min(FINDER_CONFIG.perPage, positiveInteger(input.perPage) || FINDER_CONFIG.perPage),
      rootCategory,
      nowMs: normalizeNowMs(input.nowMs),
    };
  }

  function buildFinderSelection(options = {}) {
    const normalized = normalizeCandidateQuery(options);
    const freshAfter = freshAfterKeepaMinute(normalized.nowMs);
    const selection = {
      page: FINDER_CONFIG.page,
      perPage: normalized.perPage,
      productType: FINDER_CONFIG.productType,
      availabilityAmazon: [...FINDER_CONFIG.availabilityAmazon],
      monthlySold_gte: FINDER_CONFIG.minMonthlySold,
      current_NEW_gte: FINDER_CONFIG.minNewPrice,
      avg90_NEW_gte: 1,
      current_COUNT_NEW_gte: FINDER_CONFIG.minNewOfferCount,
      current_COUNT_NEW_lte: FINDER_CONFIG.maxNewOfferCount,
      deltaPercent90_NEW_gte: FINDER_CONFIG.minPriceTo90dPercent,
      deltaPercent90_NEW_lte: FINDER_CONFIG.maxPriceTo90dPercent,
      fbaFees_gte: FINDER_CONFIG.minFbaFee,
      current_SALES_gte: FINDER_CONFIG.minSalesRank,
      current_SALES_lte: FINDER_CONFIG.maxSalesRank,
      lastUpdate_gte: freshAfter,
      lastOffersUpdate_gte: freshAfter,
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

  return { FINDER_CONFIG, normalizeCandidateQuery, buildFinderSelection, estimateFinderTokenFloor, freshAfterKeepaMinute };
});
