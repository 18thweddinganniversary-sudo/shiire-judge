module.exports = async (req, res) => {
  try {
    const brand = String(req.query.brand || '').trim();
    const rootJan = String(req.query.jan || '').replace(/\D/g, '');
    if (!brand) return res.status(400).json({ error: 'brand_required' });
    const appid = process.env.YAHOO_APP_ID;
    if (!appid) return res.status(500).json({ error: 'YAHOO_APP_ID_missing' });
    const url = new URL('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch');
    url.searchParams.set('appid', appid);
    url.searchParams.set('query', brand);
    url.searchParams.set('results', '50');
    url.searchParams.set('image_size', '300');
    const upstream = await fetch(url, { cache: 'no-store' });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(data);
    const seen = new Set();
    const candidates = (Array.isArray(data.hits) ? data.hits : []).map(hit => {
      const jan = String(hit.janCode || hit.jan_code || hit.productId || '').replace(/\D/g, '');
      return { jan, name: hit.name || '', brand: hit.brand?.name || hit.brand || brand, image: hit.image?.medium || hit.image?.small || '' };
    }).filter(item => /^\d{13}$/.test(item.jan) && item.jan !== rootJan && !seen.has(item.jan) && seen.add(item.jan)).slice(0, 10);
    return res.status(200).json({ brand, candidates });
  } catch (error) {
    return res.status(500).json({ error: 'related_api_failed', message: String(error?.message || error) });
  }
};
