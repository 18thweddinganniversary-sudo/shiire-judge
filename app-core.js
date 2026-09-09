(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShiireAppCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_AGE_MS = 6 * 60 * 60 * 1000;

  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function demandText(keepa, now = Date.now()) {
    const sold = number(keepa?.monthlySold);
    const soldAt = number(keepa?.monthlySoldUpdatedAt);
    if (sold !== null && sold >= 0 && soldAt !== null && soldAt <= now + 60_000 && now - soldAt <= MAX_AGE_MS) {
      return `${sold.toLocaleString('ja-JP')}件/月`;
    }
    const drops = number(keepa?.salesRankDrops30);
    if (drops !== null && drops >= 0) return `Rank下降 ${drops.toLocaleString('ja-JP')}回/30日`;
    const rank = number(keepa?.salesRank);
    if (rank !== null && rank > 0) return `ランキング ${rank.toLocaleString('ja-JP')}位`;
    return 'データなし';
  }

  function countText(value, suffix) {
    const parsed = number(value);
    return parsed !== null && parsed >= 0 ? `${parsed.toLocaleString('ja-JP')}${suffix}` : 'データなし';
  }

  function moneyText(value) {
    const parsed = number(value);
    return parsed !== null ? `${Math.round(parsed).toLocaleString('ja-JP')}円` : '-';
  }

  function needsKeepaRefresh(item, now = Date.now()) {
    const fetchedAt = number(item?.keepaFetchedAt);
    if (!fetchedAt || fetchedAt > now + 60_000 || now - fetchedAt > MAX_AGE_MS) return true;
    if (item?.keepa) {
      for (const timestamp of [item.keepa.productUpdatedAt, item.keepa.offersUpdatedAt]) {
        const parsed = number(timestamp);
        if (!parsed || parsed > now + 60_000 || now - parsed > MAX_AGE_MS) return true;
      }
      if (item.keepa.offersSuccessful !== true) return true;
    }
    return false;
  }

  function refreshDisposition(requestedFrom, currentJan, sheetOpen, openAfter) {
    if (!openAfter) return 'none';
    if (requestedFrom === null && currentJan === null && !sheetOpen) return 'open';
    if (requestedFrom !== null && String(requestedFrom) === String(currentJan) && sheetOpen) return 'refresh';
    return 'none';
  }

  function formatMoneyInput(raw, caret = String(raw || '').length) {
    const source = String(raw || '');
    const safeCaret = Math.max(0, Math.min(source.length, Number(caret) || 0));
    const digitsBefore = source.slice(0, safeCaret).replace(/\D/g, '').length;
    const digits = source.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (!digits) return { text: '', caret: 0, value: null };
    const value = Number(digits);
    if (!Number.isSafeInteger(value) || value <= 0) return { text: '', caret: 0, value: null };
    const text = value.toLocaleString('ja-JP');
    let seen = 0;
    let nextCaret = text.length;
    if (digitsBefore === 0) nextCaret = 0;
    else {
      for (let index = 0; index < text.length; index += 1) {
        if (/\d/.test(text[index])) seen += 1;
        if (seen === digitsBefore) {
          nextCaret = index + 1;
          break;
        }
      }
    }
    return { text, caret: nextCaret, value };
  }

  function loadItems(raw) {
    try {
      const parsed = JSON.parse(raw || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && /^\d{8,14}$/.test(String(item.jan || '')))
        .slice(0, 30);
    } catch {
      return [];
    }
  }

  return { MAX_AGE_MS, demandText, countText, moneyText, needsKeepaRefresh, refreshDisposition, formatMoneyInput, loadItems };
});
