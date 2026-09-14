const { buildSearchQuery, selectSameShelf } = require('../related-core');
const UPSTREAM_TIMEOUT_MS = 15000;

module.exports = async (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim();
    const rootJan = String(req.query.jan || '').replace(/\D/g, '');
    const rootName = String(req.query.name || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand_required' });
    const appid = process.env.YAHOO_APP_ID;
    if (!appid) return res.status(500).json({ error: 'YAHOO_APP_ID_missing' });
    const url = new URL('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch');
    url.searchParams.set('appid', appid);
    const root = { brand, jan: rootJan, name: rootName };
    url.searchParams.set('query', buildSearchQuery(root) || brand);
    url.searchParams.set('results', '50');
    url.searchParams.set('image_size', '300');
    const upstream = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    const hits = (Array.isArray(data.hits) ? data.hits : []).map(hit => {
      const jan = String(hit.janCode || hit.jan_code || hit.productId || '').replace(/\D/g, '');
      return { jan, name: hit.name || '', brand: hit.brand?.name || hit.brand || '', image: hit.image?.medium || hit.image?.small || '' };
    });
    const candidates = selectSameShelf(root, hits, 10);
    return res.status(200).json({ brand, candidates });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ error: 'related_api_timeout' });
    }
    return res.status(500).json({ error: 'related_api_failed', message: String(error?.message || error) });
  }
};
