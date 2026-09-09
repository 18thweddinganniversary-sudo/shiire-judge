(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShiireDecision = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const CONFIG = Object.freeze({
    version: '9.38',
    minProfit: 500,
    minMargin: 20,
    minRoi: 20,
    maxOffers: 15,
    minDemandLevel: 2,
    maxDataAgeMs: 6 * 60 * 60 * 1000,
    minPriceTo90d: 0.75,
    maxPriceTo90d: 1.15,
  });

  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function positive(value) {
    const parsed = number(value);
    return parsed !== null && parsed > 0 ? parsed : null;
  }

  function text(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase();
  }

  function packCount(value) {
    const source = text(value);
    const multipliers = [...source.matchAll(/(?:×|x)\s*(\d{1,3})\s*(?:本|個|袋|箱|枚|缶|パック|セット|ケース|点)/gi)]
      .map((match) => Number(match[1]))
      .filter((count) => count >= 2 && count <= 200);
    if (multipliers.length) return multipliers.reduce((total, count) => total * count, 1);
    for (const pattern of [
      /(\d{1,3})\s*(?:本|個|袋|箱|枚|缶|パック|点)\s*(?:セット|入り|入)/i,
      /(?:セット|ケース)\s*(?:内容)?\s*(\d{1,3})/i,
      /(?:^|\s)(\d{1,3})\s*(?:本|個|袋|箱|枚|缶|パック|セット|ケース|点)(?:\s|$)/i,
    ]) {
      const match = source.match(pattern);
      const count = Number(match?.[1]);
      if (count >= 1 && count <= 200) return count;
    }
    return null;
  }

  function unitRisk(item) {
    if (!item?.keepa) return null;
    const shopCount = packCount(item.name);
    const amazonCount = packCount(item.keepa.title);
    if (shopCount && amazonCount && shopCount !== amazonCount) {
      return `商品名の入数が一致しません（店頭側 ${shopCount} / Amazon側 ${amazonCount}）`;
    }
    const amazonPrice = positive(item.keepa.newPrice) || positive(item.keepa.avg90New);
    const shopPrice = positive(item.avg);
    if (amazonPrice && shopPrice) {
      const ratio = amazonPrice / shopPrice;
      if (ratio < 0.35 || ratio > 2.5) return '他市場との価格差が大きく、商品単位・ASIN違いの可能性があります';
    }
    return null;
  }

  function isFood(item) {
    const source = text(`${item?.name || ''} ${item?.keepa?.title || ''}`);
    return /(コーヒー|珈琲|ネスカフェ|スターバックス|マヨネーズ|食品|飲料|お茶|茶葉|紅茶|緑茶|ジュース|菓子|キャンディ|チョコ|スナック|調味料|ソース|ドレッシング|レトルト|即席|インスタント)/i.test(source)
      && !/(メーカー|マシン|コーヒーメーカー|ドリッパー|タンブラー|カップ|家電)/i.test(source);
  }

  function referralRate(item, salePrice) {
    const apiRate = positive(item?.keepa?.referralFeePercentage);
    if (!apiRate) return null;
    if (!isFood(item)) return apiRate;
    const price = positive(salePrice);
    if (!price) return apiRate;
    const conservativeRate = price <= 750 ? 5 : price <= 1500 ? 8.4 : 10.4;
    return Math.max(apiRate, conservativeRate);
  }

  function safeLimitAtSale(item, salePrice) {
    if (!item || unitRisk(item)) return null;
    const sale = positive(salePrice);
    const fba = number(item.keepa?.fbaFee);
    const rate = referralRate(item, sale);
    const closing = Math.max(0, number(item.keepa?.variableClosingFee) || 0);
    if (!sale || fba === null || fba < 0 || !rate) return null;
    const fees = Math.round(sale * rate / 100) + fba + closing;
    const beforeCost = sale - fees;
    const limits = [
      beforeCost - CONFIG.minProfit,
      sale * (1 - CONFIG.minMargin / 100) - fees,
      beforeCost / (1 + CONFIG.minRoi / 100),
    ];
    const limit = Math.floor(Math.min(...limits));
    return limit > 0 ? limit : null;
  }

  function canonicalSafeGuide(item) {
    if (!item || unitRisk(item)) return null;
    const current = positive(item.keepa?.newPrice);
    const average = positive(item.keepa?.avg90New);
    if (!current || !average) return null;
    const currentSafe = safeLimitAtSale(item, current);
    const ninetySafe = safeLimitAtSale(item, average);
    if (!currentSafe || !ninetySafe) return null;
    return { safe: Math.min(currentSafe, ninetySafe), currentSafe, ninetySafe };
  }

  function demandLevel(keepa) {
    const sold = number(keepa?.monthlySold);
    if (sold !== null) return sold >= 100 ? 3 : sold >= 30 ? 2 : sold >= 10 ? 1 : 0;
    const drops = number(keepa?.salesRankDrops30);
    return drops !== null ? (drops >= 30 ? 3 : drops >= 10 ? 2 : drops >= 3 ? 1 : 0) : 0;
  }

  function calculateDecision(item, costValue, overrides = {}) {
    if (unitRisk(item)) return null;
    const cost = positive(costValue);
    const sale = positive(overrides.salePrice) || positive(item?.keepa?.newPrice) || positive(item?.keepa?.avg90New);
    const fba = number(overrides.fbaFee ?? item?.keepa?.fbaFee);
    const rate = positive(overrides.referralRate) || referralRate(item, sale);
    const other = Math.max(0, number(overrides.otherCost) || 0);
    const closing = Math.max(0, number(item?.keepa?.variableClosingFee) || 0);
    if (!cost || !sale || fba === null || fba < 0 || !rate) return null;
    const fees = Math.round(sale * rate / 100) + fba + closing + other;
    const profit = Math.round(sale - fees - cost);
    return {
      cost,
      sale,
      fees,
      profit,
      margin: Math.round(profit / sale * 10000) / 100,
      roi: Math.round(profit / cost * 10000) / 100,
    };
  }

  function gateReasons(item, decision, now = Date.now()) {
    const keepa = item?.keepa || {};
    const reasons = [];
    if (!keepa.asin) reasons.push('ASIN未確定');
    if (unitRisk(item)) reasons.push('商品単位/ASIN要確認');
    if (!positive(keepa.newPrice)) reasons.push('現在価格不足');
    if (!positive(keepa.avg90New)) reasons.push('90日価格不足');
    if (number(keepa.fbaFee) === null || number(keepa.fbaFee) < 0 || !positive(keepa.referralFeePercentage)) reasons.push('実手数料不足');
    if (keepa.amazonPresent) reasons.push('Amazon本体在庫あり');
    const offers = number(keepa.newOfferCount);
    if (offers === null) reasons.push('出品者数不明');
    else if (offers > CONFIG.maxOffers) reasons.push('出品者過多');
    if (demandLevel(keepa) < CONFIG.minDemandLevel) reasons.push('回転不足');
    const current = positive(keepa.newPrice);
    const average = positive(keepa.avg90New);
    if (current && average) {
      const ratio = current / average;
      if (ratio < CONFIG.minPriceTo90d || ratio > CONFIG.maxPriceTo90d) reasons.push('価格安定条件外');
    }
    const fetchedAt = number(item?.keepaFetchedAt);
    if (!fetchedAt || now - fetchedAt > CONFIG.maxDataAgeMs || fetchedAt > now + 60_000) reasons.push('データ鮮度不足');
    const safeGuide = canonicalSafeGuide(item);
    if (!safeGuide) reasons.push('安全目安なし');
    if (!decision) reasons.push('仕入れ価格未入力');
    else {
      if (safeGuide && decision.cost > safeGuide.safe) reasons.push('安全目安超過');
      if (decision.profit < CONFIG.minProfit) reasons.push('利益不足');
      if (decision.margin < CONFIG.minMargin) reasons.push('利益率不足');
      if (decision.roi < CONFIG.minRoi) reasons.push('ROI不足');
    }
    return [...new Set(reasons)];
  }

  function evaluate(item, costValue, overrides = {}) {
    const decision = calculateDecision(item, costValue, overrides);
    const reasons = gateReasons(item, decision, overrides.now || Date.now());
    const green = reasons.length === 0;
    return {
      signal: green ? '🟢' : '🔴',
      label: green ? '仕入れ候補' : '見送り',
      reasons,
      decision,
      guide: canonicalSafeGuide(item),
    };
  }

  return { CONFIG, packCount, unitRisk, referralRate, safeLimitAtSale, canonicalSafeGuide, demandLevel, calculateDecision, gateReasons, evaluate };
});
