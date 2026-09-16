'use strict';

const { buildFinderSelection, normalizeCandidateQuery, estimateFinderTokenFloor } = require('../candidate-core');

const UPSTREAM_TIMEOUT_MS = 15000;

function tokenMeta(data) {
  return {
    tokensLeft: data?.tokensLeft ?? null,
    tokensConsumed: data?.tokensConsumed ?? null,
    refillRate: data?.refillRate ?? null,
    refillIn: data?.refillIn ?? null,
    tokenFlowReduction: data?.tokenFlowReduction ?? null,
  };
}

module.exports = async (req, res) => {
  try {
    const key = process.env.KEEPA_API_KEY;
    if (!key) return res.status(500).json({ ok: false, configured: false, error: 'KEEPA_API_KEY_missing' });

    const options = normalizeCandidateQuery({
      rootCategory: req?.query?.category,
      perPage: req?.query?.perPage,
    });
    const selection = buildFinderSelection(options);
    const url = new URL('https://api.keepa.com/query');
    url.searchParams.set('key', key);
    url.searchParams.set('domain', '5');
    url.searchParams.set('selection', JSON.stringify(selection));

    const response = await fetch(url, {
      headers: { 'Accept-Encoding': 'gzip' },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await response.json();
    const meta = tokenMeta(data);

    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ ok: false, configured: true, error: 'token_limit', ...meta });
      return res.status(response.status || 502).json({ ok: false, configured: true, error: 'keepa_candidate_api_error', ...meta });
    }

    if (!Array.isArray(data?.asinList) || !Number.isFinite(Number(data?.totalResults))) {
      return res.status(502).json({ ok: false, configured: true, error: 'keepa_candidate_response_invalid', ...meta });
    }

    const candidates = data.asinList.filter((asin) => typeof asin === 'string' && /^B[A-Z0-9]{9}$/.test(asin));
    return res.status(200).json({
      ok: true,
      configured: true,
      candidates,
      totalResults: Number(data.totalResults),
      estimatedMinimumTokens: estimateFinderTokenFloor(candidates.length),
      ...meta,
      query: {
        domain: 5,
        selection,
      },
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ ok: false, configured: true, error: 'keepa_candidate_api_timeout' });
    }
    return res.status(502).json({ ok: false, configured: true, error: 'keepa_candidate_api_failed' });
  }
};
