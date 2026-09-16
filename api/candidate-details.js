'use strict';

const { parseProduct } = require('../keepa-core');
const { canonicalSafeGuide } = require('../decision-engine');

const UPSTREAM_TIMEOUT_MS = 15000;
const MAX_CANDIDATES = 5;
const ASIN_RE = /^B[A-Z0-9]{9}$/;

function tokenMeta(data) {
  return {
    tokensLeft: data?.tokensLeft ?? null,
    tokensConsumed: data?.tokensConsumed ?? null,
    refillRate: data?.refillRate ?? null,
    refillIn: data?.refillIn ?? null,
    tokenFlowReduction: data?.tokenFlowReduction ?? null,
  };
}

function normalizeAsins(value) {
  const raw = String(value || '').split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean);
  if (raw.length > MAX_CANDIDATES) return { error: 'candidate_batch_too_large', asins: [] };
  const asins = [...new Set(raw)];
  if (!asins.length || asins.some((asin) => !ASIN_RE.test(asin))) return { error: 'candidate_asin_invalid', asins: [] };
  return { error: null, asins };
}

function janFromProduct(product) {
  const codes = ['eanList', 'upcList', 'gtinList']
    .flatMap((field) => Array.isArray(product?.[field]) ? product[field] : [])
    .map((code) => String(code).replace(/\D/g, ''));
  return codes.find((code) => /^\d{13}$/.test(code)) || null;
}

module.exports = async (req, res) => {
  try {
    const parsed = normalizeAsins(req?.query?.asins);
    if (parsed.error) return res.status(400).json({ ok: false, error: parsed.error, maxCandidates: MAX_CANDIDATES });

    const key = process.env.KEEPA_API_KEY;
    if (!key) return res.status(500).json({ ok: false, configured: false, error: 'KEEPA_API_KEY_missing' });

    const url = new URL('https://api.keepa.com/product');
    url.searchParams.set('key', key);
    url.searchParams.set('domain', '5');
    url.searchParams.set('asin', parsed.asins.join(','));
    url.searchParams.set('history', '0');
    url.searchParams.set('stats', '90');

    const response = await fetch(url, {
      headers: { 'Accept-Encoding': 'gzip' },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await response.json();
    const meta = tokenMeta(data);

    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ ok: false, configured: true, error: 'token_limit', ...meta });
      return res.status(response.status || 502).json({ ok: false, configured: true, error: 'keepa_candidate_detail_api_error', ...meta });
    }

    if (!Array.isArray(data?.products)) return res.status(502).json({ ok: false, configured: true, error: 'keepa_candidate_detail_response_invalid', ...meta });

    const byAsin = new Map(data.products.map((product) => [String(product?.asin || '').toUpperCase(), product]));
    const fetchedAt = Date.now();
    const details = parsed.asins.map((asin) => {
      const raw = byAsin.get(asin);
      if (!raw) return { asin, found: false, needsStoreVerification: true };
      const keepa = parseProduct(raw, 5);
      const item = { jan: janFromProduct(raw), name: keepa.title, keepa, keepaFetchedAt: fetchedAt };
      const guide = canonicalSafeGuide(item);
      return {
        asin,
        found: true,
        jan: item.jan,
        title: keepa.title,
        brand: keepa.brand,
        newPrice: keepa.newPrice,
        avg90New: keepa.avg90New,
        monthlySold: keepa.monthlySold,
        salesRank: keepa.salesRank,
        salesRankDrops30: keepa.salesRankDrops30,
        newOfferCount: keepa.newOfferCount,
        amazonPresent: keepa.amazonPresent,
        fbaFee: keepa.fbaFee,
        referralFeePercentage: keepa.referralFeePercentage,
        preliminarySafeLimit: guide?.safe ?? null,
        currentSafeLimit: guide?.currentSafe ?? null,
        ninetyDaySafeLimit: guide?.ninetySafe ?? null,
        needsStoreVerification: true,
      };
    });

    return res.status(200).json({
      ok: true,
      configured: true,
      requested: parsed.asins.length,
      details,
      ...meta,
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ ok: false, configured: true, error: 'keepa_candidate_detail_api_timeout' });
    }
    return res.status(502).json({ ok: false, configured: true, error: 'keepa_candidate_detail_api_failed' });
  }
};

module.exports.normalizeAsins = normalizeAsins;
module.exports.janFromProduct = janFromProduct;
