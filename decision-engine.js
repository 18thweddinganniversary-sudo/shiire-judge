(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShiireDecision = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const CONFIG = Object.freeze({
    version: '9.43',
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

  function packaging(value) {
    const source = text(value);
    const capacity = source.match(/(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/i);
    const capacityValue = Number(capacity?.[1]);
    const capacityUnit = capacity?.[2]?.toLowerCase();
    const tokens = [...source.matchAll(/(\d{1,4})\s*(本|缶|個|袋|枚|パック|点|箱|ケース|セット)(?!\s*(?:あたり|当たり))/gi)]
      .map((match) => ({ count: Number(match[1]), unit: match[2] }))
      .filter(({ count }) => count >= 1 && count <= 1000);
    const baseTokens = tokens.filter(({ unit }) => /^(?:本|缶|個|袋|枚|パック|点)$/.test(unit));
    const explicit = source.match(/計\s*(\d{1,4})\s*(?:本|缶|個|袋|枚|パック|点)/i);
    const outer = tokens.filter(({ unit }) => /^(?:箱|ケース|セット)$/.test(unit));
    let totalUnits = Number(explicit?.[1]) || null;
    if (!totalUnits && baseTokens.length) {
      totalUnits = /[×x]/i.test(source)
        ? tokens.reduce((total, token) => total * token.count, 1)
        : baseTokens[0].count * (outer.length ? outer.reduce((total, token) => total * token.count, 1) : 1);
    }
    return {
      totalUnits: totalUnits && totalUnits <= 10000 ? totalUnits : null,
      unitCapacityMl: capacityUnit === 'ml' ? capacityValue : capacityUnit === 'l' ? capacityValue * 1000 : null,
      unitWeightG: capacityUnit === 'g' ? capacityValue : capacityUnit === 'kg' ? capacityValue * 1000 : null,
    };
  }

  function packCount(value) {
    return packaging(value).totalUnits;
  }

  function unitRisk(item) {
    if (!item?.keepa) return null;
    const shopPack = packaging(item.name);
    const amazonPack = packaging(item.keepa.title);
    const shopCount = shopPack.totalUnits;
    const amazonCount = amazonPack.totalUnits;
    if ((shopCount !== null || amazonCount !== null) && shopCount !== amazonCount) {
      return `商品名の入数が一致しません（店頭側 ${shopCount} / Amazon側 ${amazonCount}）`;
    }
    for (const field of ['unitCapacityMl', 'unitWeightG']) {
      if ((shopPack[field] !== null || amazonPack[field] !== null) && shopPack[field] !== amazonPack[field]) {
        return '商品名の容量・重量が一致しません';
      }
    }
    if (isFood(item) && (shopCount === null || amazonCount === null
      || (shopPack.unitCapacityMl === null && shopPack.unitWeightG === null)
      || (amazonPack.unitCapacityMl === null && amazonPack.unitWeightG === null))) {
      return '食品・飲料の容量または入数を確認できません';
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

  function closingFee(keepa) {
    const fee = number(keepa?.variableClosingFee);
    if (fee !== null && fee >= 0) return fee;
    return keepa?.variableClosingFeeApplicable === false ? 0 : null;
  }

  function safeLimitAtSale(item, salePrice, overrides = {}) {
    if (!item || unitRisk(item)) return null;
    const sale = positive(salePrice);
    const fba = number(overrides.fbaFee ?? item.keepa?.fbaFee);
    const rate = positive(overrides.referralRate) || referralRate(item, sale);
    const closing = closingFee(item.keepa);
    const other = Math.max(0, number(overrides.otherCost) || 0);
    if (!sale || fba === null || fba < 0 || closing === null || closing < 0 || !rate) return null;
    const fees = Math.round(sale * rate / 100) + fba + closing + other;
    const beforeCost = sale - fees;
    const limits = [
      beforeCost - CONFIG.minProfit,
      sale * (1 - CONFIG.minMargin / 100) - fees,
      beforeCost / (1 + CONFIG.minRoi / 100),
    ];
    const limit = Math.floor(Math.min(...limits));
    return limit > 0 ? limit : null;
  }

  function canonicalSafeGuide(item, overrides = {}) {
    if (!item || unitRisk(item)) return null;
    const current = positive(item.keepa?.newPrice);
    const average = positive(item.keepa?.avg90New);
    if (!current || !average) return null;
    const currentSafe = safeLimitAtSale(item, current, overrides);
    const ninetySafe = safeLimitAtSale(item, average, overrides);
    if (!currentSafe || !ninetySafe) return null;
    return { safe: Math.min(currentSafe, ninetySafe), currentSafe, ninetySafe };
  }

  function timestampFresh(value, now = Date.now()) {
    const timestamp = number(value);
    return timestamp !== null && timestamp <= now + 60_000 && now - timestamp <= CONFIG.maxDataAgeMs;
  }

  function freshnessIssues(item, now = Date.now()) {
    const keepa = item?.keepa;
    const reasons = [];
    if (!timestampFresh(item?.keepaFetchedAt, now)) reasons.push('データ鮮度不足');
    if (keepa && !timestampFresh(keepa.productUpdatedAt, now)) reasons.push('商品データ鮮度不足');
    if (keepa && number(keepa.newOfferCount) !== null
      && (keepa.offersSuccessful !== true || !timestampFresh(keepa.offersUpdatedAt, now))) reasons.push('出品者データ鮮度不足');
    return reasons;
  }

  function demandEvidence(keepa, now = Date.now()) {
    const sold = number(keepa?.monthlySold);
    if (sold !== null && sold >= 0 && timestampFresh(keepa?.monthlySoldUpdatedAt, now)) {
      return { source: 'monthlySold', value: sold, level: sold >= 100 ? 3 : sold >= 30 ? 2 : sold >= 10 ? 1 : 0 };
    }
    const drops = number(keepa?.salesRankDrops30);
    if (drops !== null && drops >= 0) return { source: 'salesRankDrops30', value: drops, level: drops >= 30 ? 3 : drops >= 10 ? 2 : drops >= 3 ? 1 : 0 };
    return { source: null, value: null, level: null };
  }

  function demandLevel(keepa, now = Date.now()) {
    return demandEvidence(keepa, now).level;
  }

  function calculateDecision(item, costValue, overrides = {}) {
    if (unitRisk(item)) return null;
    const cost = positive(costValue);
    const sale = positive(overrides.salePrice) || positive(item?.keepa?.newPrice) || positive(item?.keepa?.avg90New);
    const fba = number(overrides.fbaFee ?? item?.keepa?.fbaFee);
    const rate = positive(overrides.referralRate) || referralRate(item, sale);
    const other = Math.max(0, number(overrides.otherCost) || 0);
    const closing = closingFee(item?.keepa);
    if (!cost || !sale || fba === null || fba < 0 || closing === null || closing < 0 || !rate) return null;
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

  function gateReasons(item, decision, now = Date.now(), overrides = {}, costValue = null) {
    const keepa = item?.keepa || {};
    const reasons = [];
    if (!keepa.asin) reasons.push('ASIN未確定');
    if (unitRisk(item)) reasons.push('商品単位/ASIN要確認');
    if (!positive(keepa.newPrice)) reasons.push('現在価格不足');
    if (!positive(keepa.avg90New)) reasons.push('90日価格不足');
    if (number(keepa.fbaFee) === null || number(keepa.fbaFee) < 0
      || closingFee(keepa) === null
      || !positive(keepa.referralFeePercentage)) reasons.push('実手数料不足');
    if (keepa.amazonPresent) reasons.push('Amazon本体在庫あり');
    const offers = number(keepa.newOfferCount);
    if (offers === null) reasons.push('出品者数不明');
    else {
      if (offers > CONFIG.maxOffers) reasons.push('出品者過多');
    }
    const demand = demandEvidence(keepa, now);
    if (demand.level === null) reasons.push('回転データ不足');
    else if (demand.level < CONFIG.minDemandLevel) reasons.push('回転不足');
    const current = positive(keepa.newPrice);
    const average = positive(keepa.avg90New);
    if (current && average) {
      const ratio = current / average;
      if (ratio < CONFIG.minPriceTo90d || ratio > CONFIG.maxPriceTo90d) reasons.push('価格安定条件外');
    }
    reasons.push(...freshnessIssues(item, now));
    const safeGuide = canonicalSafeGuide(item, overrides);
    if (!safeGuide) reasons.push('利益条件上限算出不可');
    if (!decision) {
      if (!positive(costValue)) reasons.push('仕入れ価格未入力');
    }
    else {
      if (safeGuide && decision.cost > safeGuide.safe) reasons.push('利益条件上限超過');
      if (decision.profit < CONFIG.minProfit) reasons.push('利益不足');
      if (decision.margin < CONFIG.minMargin) reasons.push('利益率不足');
      if (decision.roi < CONFIG.minRoi) reasons.push('ROI不足');
    }
    return [...new Set(reasons)];
  }

  function evaluate(item, costValue, overrides = {}) {
    const decision = calculateDecision(item, costValue, overrides);
    const reasons = gateReasons(item, decision, overrides.now || Date.now(), overrides, costValue);
    const green = reasons.length === 0;
    const measuredRejectReasons = new Set([
      'Amazon本体在庫あり', '出品者過多', '回転不足', '価格安定条件外',
      '利益条件上限超過', '利益不足', '利益率不足', 'ROI不足',
    ]);
    const measuredReject = reasons.some((reason) => measuredRejectReasons.has(reason));
    return {
      signal: green ? '🟢' : '🔴',
      label: green ? 'GO（仕入れ）' : measuredReject ? '見送り' : '判定不能',
      reasons,
      decision,
      guide: canonicalSafeGuide(item, overrides),
    };
  }

  return { CONFIG, packCount, unitRisk, referralRate, closingFee, safeLimitAtSale, canonicalSafeGuide, demandEvidence, demandLevel, freshnessIssues, calculateDecision, gateReasons, evaluate };
});
