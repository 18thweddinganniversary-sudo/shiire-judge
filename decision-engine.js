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

  function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
  function pct(v) { return Math.round(v * 10) / 10; }
  function yen(v) { return Math.floor(v); }
  function feeTotal(k, salePrice) {
    const fba = num(k?.fbaFee), referral = num(k?.referralFeePercent), closing = num(k?.variableClosingFee), other = num(k?.otherFee) ?? 0;
    if (fba === null || referral === null || closing === null) return null;
    return fba + salePrice * referral / 100 + closing + other;
  }
  function profitAt(k, salePrice, cost) {
    const fees = feeTotal(k, salePrice);
    if (fees === null) return null;
    const profit = salePrice - fees - cost;
    return { salePrice, fees: yen(fees), profit: yen(profit), margin: pct(profit / salePrice * 100), roi: pct(profit / cost * 100) };
  }
  function safeAt(k, salePrice) {
    const fees = feeTotal(k, salePrice);
    if (fees === null) return null;
    const net = salePrice - fees;
    const byProfit = net - CONFIG.minProfit;
    const byMargin = net - salePrice * CONFIG.minMargin / 100;
    const byRoi = net / (1 + CONFIG.minRoi / 100);
    return Math.floor(Math.min(byProfit, byMargin, byRoi));
  }
  function demandLevel(k) {
    if (!k) return null;
    const monthlyFresh = k.monthlySoldFresh !== false;
    const monthly = monthlyFresh ? num(k.monthlySold) : null;
    if (monthly !== null) return monthly >= 20 ? 3 : monthly >= 8 ? 2 : monthly > 0 ? 1 : 0;
    const drops = num(k.salesRankDrops30);
    if (drops !== null) return drops >= 20 ? 3 : drops >= 8 ? 2 : drops > 0 ? 1 : 0;
    return null;
  }
  function timestampFresh(ts, now = Date.now()) {
    const n = num(ts);
    return n !== null && n <= now && now - n <= CONFIG.maxDataAgeMs;
  }
  function freshnessIssues(item, now = Date.now()) {
    const k = item?.keepa;
    const issues = [];
    if (!timestampFresh(item?.keepaFetchedAt, now)) issues.push('Keepa取得から6時間超過');
    if (!timestampFresh(k?.productUpdatedAt, now)) issues.push('Keepa商品データが古い');
    if (num(k?.newOfferCount) !== null && !timestampFresh(k?.offersUpdatedAt, now)) issues.push('出品者データが古い');
    return issues;
  }
  function dataIssues(item, now = Date.now()) {
    const k = item?.keepa;
    const issues = [];
    if (!k?.asin) issues.push('ASIN未確認');
    if (item?.unitRisk) issues.push('商品内容・入数が一致しない可能性');
    if (num(k?.newPrice) === null) issues.push('現在新品価格なし');
    if (num(k?.avg90New) === null) issues.push('90日平均価格なし');
    if (num(k?.fbaFee) === null) issues.push('FBA手数料未確認');
    if (num(k?.referralFeePercent) === null) issues.push('販売手数料率未確認');
    if (num(k?.variableClosingFee) === null) issues.push('カテゴリー成約料未確認');
    if (num(k?.newOfferCount) === null) issues.push('新品出品者数未確認');
    if (demandLevel(k) === null) issues.push('回転データ不足');
    issues.push(...freshnessIssues(item, now));
    return [...new Set(issues)];
  }
  function commercialIssues(item) {
    const k = item?.keepa || {};
    const issues = [];
    const offers = num(k.newOfferCount), demand = demandLevel(k), current = num(k.newPrice), avg = num(k.avg90New);
    if (k.amazonPresent === true) issues.push('Amazon本体が販売中');
    if (offers !== null && offers > CONFIG.maxOffers) issues.push(`新品出品者${CONFIG.maxOffers}人超`);
    if (demand !== null && demand < CONFIG.minDemandLevel) issues.push('回転不足');
    if (current !== null && avg !== null && avg > 0) {
      const ratio = current / avg;
      if (ratio < CONFIG.minPriceTo90d || ratio > CONFIG.maxPriceTo90d) issues.push('現在価格が90日平均から外れています');
    }
    return issues;
  }
  function canonicalSafeGuide(item) {
    const k = item?.keepa;
    if (!k) return null;
    const current = num(k.newPrice), avg = num(k.avg90New);
    if (current === null || avg === null) return null;
    const currentSafe = safeAt(k, current), ninetySafe = safeAt(k, avg);
    if (currentSafe === null || ninetySafe === null) return null;
    return { currentSafe, ninetySafe, safe: Math.min(currentSafe, ninetySafe) };
  }
  function evaluate(item, cost, now = Date.now()) {
    const missing = dataIssues(item, now);
    const commercial = commercialIssues(item);
    const guide = canonicalSafeGuide(item);
    const c = num(cost);
    if (missing.length) return { signal: '🔴', label: '判定不能', reasons: missing, guide, decision: null };
    if (commercial.length) return { signal: '🔴', label: '見送り', reasons: commercial, guide, decision: c ? profitAt(item.keepa, item.keepa.newPrice, c) : null };
    if (c === null || c <= 0) return { signal: '🔴', label: '仕入れ価格を入力', reasons: ['仕入れ価格未入力'], guide, decision: null };
    const d = profitAt(item.keepa, item.keepa.newPrice, c);
    const d90 = profitAt(item.keepa, item.keepa.avg90New, c);
    const profitIssues = [];
    for (const [label, x] of [['現在価格', d], ['90日平均', d90]]) {
      if (!x || x.profit < CONFIG.minProfit) profitIssues.push(`${label}の利益${CONFIG.minProfit}円未満`);
      if (!x || x.margin < CONFIG.minMargin) profitIssues.push(`${label}の利益率${CONFIG.minMargin}%未満`);
      if (!x || x.roi < CONFIG.minRoi) profitIssues.push(`${label}のROI${CONFIG.minRoi}%未満`);
    }
    if (guide && c > guide.safe) profitIssues.push('利益条件上の仕入上限を超えています');
    if (profitIssues.length) return { signal: '🔴', label: '見送り', reasons: [...new Set(profitIssues)], guide, decision: d };
    return { signal: '🟢', label: 'GO（仕入れ）', reasons: [], guide, decision: d };
  }
  return { CONFIG, feeTotal, profitAt, safeAt, demandLevel, timestampFresh, freshnessIssues, dataIssues, commercialIssues, canonicalSafeGuide, evaluate };
});
