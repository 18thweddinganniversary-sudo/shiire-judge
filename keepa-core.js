'use strict';

const KEEPA_EPOCH_MS = Date.UTC(2011, 0, 1);

const CSV = Object.freeze({ AMAZON: 0, NEW: 1, SALES: 3, COUNT_NEW: 11, BUY_BOX_SHIPPING: 18 });

function value(input) {
  if (input === null || input === undefined || input === '') return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function positive(input) {
  const parsed = value(input);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function keepaTime(input) {
  const minutes = positive(input);
  return minutes === null ? null : KEEPA_EPOCH_MS + minutes * 60_000;
}

function feeTotal(fees) {
  if (!fees) return null;
  const base = positive(fees.pickAndPackFee);
  const tax = value(fees.pickAndPackFeeTax);
  if (base === null || tax === null) return null;
  return base + tax;
}

function parseProduct(product) {
  const stats = product?.stats || {};
  const current = Array.isArray(stats.current) ? stats.current : [];
  const avg90 = Array.isArray(stats.avg90) ? stats.avg90 : [];
  const rawMonthlySold = value(product?.monthlySold);
  const monthlySold = rawMonthlySold === 0 && !positive(product?.lastSoldUpdate) ? null : rawMonthlySold;
  const amazonPrice = positive(current[CSV.AMAZON]);

  return {
    asin: product?.asin || null,
    title: product?.title || '',
    brand: product?.brand || '',
    monthlySold,
    salesRankDrops30: value(stats.salesRankDrops30),
    salesRank: positive(current[CSV.SALES]),
    newPrice: positive(current[CSV.NEW]),
    buyBox: positive(current[CSV.BUY_BOX_SHIPPING]),
    avg90New: positive(avg90[CSV.NEW]),
    newOfferCount: value(current[CSV.COUNT_NEW]),
    offersSuccessful: product?.offersSuccessful === true,
    amazonPresent: amazonPrice !== null || stats.buyBoxIsAmazon === true,
    fbaFee: feeTotal(product?.fbaFees),
    referralFeePercentage: positive(product?.referralFeePercentage),
    variableClosingFee: value(product?.variableClosingFee),
    productUpdatedAt: keepaTime(product?.lastUpdate),
    offersUpdatedAt: keepaTime(stats.lastOffersUpdate),
    monthlySoldUpdatedAt: keepaTime(product?.lastSoldUpdate),
  };
}

module.exports = { CSV, value, positive, keepaTime, parseProduct };
