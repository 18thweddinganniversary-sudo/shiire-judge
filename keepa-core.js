'use strict';

const KEEPA_EPOCH_MS = Date.UTC(2011, 0, 1);
const CSV = Object.freeze({ AMAZON: 0, NEW: 1, SALES: 3, COUNT_NEW: 11, BUY_BOX_SHIPPING: 18 });
function value(input) { if (input === null || input === undefined || input === '') return null; const parsed = Number(input); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
function positive(input) { const parsed = value(input); return parsed !== null && parsed > 0 ? parsed : null; }
function keepaTime(input) { const minutes = positive(input); return minutes === null ? null : KEEPA_EPOCH_MS + minutes * 60_000; }
function parseFbaFee(fees, domainId = null) {
  if (!fees) return { total: null, status: 'not_collected', components: null };
  const base = positive(fees.pickAndPackFee); const tax = value(fees.pickAndPackFeeTax); const components = { pickAndPackFee: base, pickAndPackFeeTax: tax };
  if (base === null) return { total: null, status: 'invalid_dimensions', components };
  if (Number(domainId) === 5) return { total: base, status: 'available_tax_inclusive', components };
  if (tax === null) return { total: null, status: 'tax_unavailable', components };
  return { total: base + tax, status: 'available', components };
}
function closingFeeApplicability(product) {
  const categoryPath = Array.isArray(product?.categoryTree) ? product.categoryTree.map((entry) => String(entry?.name || '').trim()).filter(Boolean) : [];
  if (!categoryPath.length) return { applicable: null, categoryPath };
  const categories = categoryPath.join(' ').normalize('NFKC').toLowerCase();
  const applicable = /(本|書籍|book|ミュージック|音楽|music|cd|レコード|vinyl|dvd|blu.?ray|ビデオ|video|vhs|pcソフト|software|ゲーム|game|console|switch|playstation|xbox)/i.test(categories);
  return { applicable, categoryPath };
}
function parseProduct(product, domainId = product?.domainId) {
  const stats = product?.stats || {}; const current = Array.isArray(stats.current) ? stats.current : []; const avg90 = Array.isArray(stats.avg90) ? stats.avg90 : [];
  const rawMonthlySold = value(product?.monthlySold); const monthlySold = rawMonthlySold === 0 && !positive(product?.lastSoldUpdate) ? null : rawMonthlySold;
  const amazonPrice = positive(current[CSV.AMAZON]); const fbaFee = parseFbaFee(product?.fbaFees, domainId); const closingFee = closingFeeApplicability(product);
  const offersUpdatedAt = keepaTime(stats.lastOffersUpdate);
  return {
    asin: product?.asin || null, title: product?.title || '', brand: product?.brand || '', monthlySold,
    salesRankDrops30: value(stats.salesRankDrops30), salesRank: positive(current[CSV.SALES]), newPrice: positive(current[CSV.NEW]), buyBox: positive(current[CSV.BUY_BOX_SHIPPING]), avg90New: positive(avg90[CSV.NEW]),
    newOfferCount: value(current[CSV.COUNT_NEW]),
    // A normal low-cost product response can carry Keepa's cached offer count and
    // lastOffersUpdate without returning marketplace offer pages. The decision
    // engine still enforces the 6-hour timestamp, so stale counts can never go green.
    offersSuccessful: product?.offersSuccessful === true || offersUpdatedAt !== null,
    amazonPresent: amazonPrice !== null || stats.buyBoxIsAmazon === true,
    fbaFee: fbaFee.total, fbaFeeStatus: fbaFee.status, fbaFeeComponents: fbaFee.components,
    referralFeePercentage: positive(product?.referralFeePercentage), variableClosingFee: value(product?.variableClosingFee), variableClosingFeeApplicable: closingFee.applicable, categoryPath: closingFee.categoryPath,
    productUpdatedAt: keepaTime(product?.lastUpdate), offersUpdatedAt, monthlySoldUpdatedAt: keepaTime(product?.lastSoldUpdate),
  };
}
module.exports = { CSV, value, positive, keepaTime, parseFbaFee, closingFeeApplicability, parseProduct };
