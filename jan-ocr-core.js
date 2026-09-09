(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShiireJan = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function normalizeJan(value) {
    return String(value || '').normalize('NFKC').replace(/\D/g, '');
  }

  function validJan(value) {
    const code = normalizeJan(value);
    if (!/^\d{13}$/.test(code)) return false;
    const digits = code.split('').map(Number);
    const check = digits.pop();
    let sum = 0;
    let weight = 3;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      sum += digits[index] * weight;
      weight = weight === 3 ? 1 : 3;
    }
    return (10 - sum % 10) % 10 === check;
  }

  function extractJanFromText(value) {
    const source = String(value || '').normalize('NFKC');
    const labelled = [...source.matchAll(/JAN\s*[:：]?\s*([0-9][0-9\s-]{11,18}[0-9])/ig)]
      .map((match) => normalizeJan(match[1]));
    for (const code of labelled) if (validJan(code)) return code;
    const digits = normalizeJan(source);
    for (let index = 0; index <= digits.length - 13; index += 1) {
      const code = digits.slice(index, index + 13);
      if (validJan(code)) return code;
    }
    return null;
  }

  return { normalizeJan, validJan, extractJanFromText };
});
