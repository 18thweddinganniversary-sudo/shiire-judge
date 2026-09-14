const UPSTREAM_TIMEOUT_MS = 15000;
const UNRELIABLE_LISTING = /中古|ジャンク|訳あり|本体のみ|箱なし|欠品|動作未確認/i;

function usableNewListing(hit) {
  const condition = String(hit?.condition || hit?.conditionType || '').toLowerCase();
  return !/(used|中古|refurbished|ジャンク)/i.test(condition)
    && !UNRELIABLE_LISTING.test(String(hit?.name || ''));
}

module.exports = async (req, res) => {
  try {
    const jan = String(req.query.jan || '').trim();
    if (!jan) {
      return res.status(400).json({ error: 'jan_required' });
    }

    const appid = process.env.YAHOO_APP_ID;
    if (!appid) {
      return res.status(500).json({ error: 'YAHOO_APP_ID_missing' });
    }

    const url = new URL('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch');
    url.searchParams.set('appid', appid);
    url.searchParams.set('jan_code', jan);
    url.searchParams.set('image_size', '300');
    url.searchParams.set('results', '100');

    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json(data);
    }

    const allHits = Array.isArray(data.hits) ? data.hits : [];
    const hits = allHits.filter(usableNewListing);

    if (!hits.length) {
      return res.status(200).json({
        found: false,
        jan,
        reason: allHits.length ? 'only_used_or_incomplete_listings' : 'not_found'
      });
    }

    const first = hits[0];
    const prices = hits
      .map(x => Number(x.price))
      .filter(x => Number.isFinite(x) && x > 0);

    const avg = prices.length
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : 0;

    return res.status(200).json({
      found: true,
      jan,
      name: first.name || '',
      brand: first.brand?.name || first.brand || '',
      image: first.image?.medium || first.image?.small || '',
      count: hits.length,
      avg,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return res.status(504).json({ error: 'product_api_timeout' });
    }
    return res.status(500).json({
      error: 'product_api_failed',
      message: String(err?.message || err)
    });
  }
};
