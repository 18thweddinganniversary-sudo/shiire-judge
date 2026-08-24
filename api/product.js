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

    const url =
      'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch' +
      '?appid=' + encodeURIComponent(appid) +
      '&jan_code=' + encodeURIComponent(jan) +
      '&image_size=300&results=100';

    const r = await fetch(url, { cache: 'no-store' });
    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json(data);
    }

    const hits = Array.isArray(data.hits) ? data.hits : [];

    if (!hits.length) {
      return res.status(200).json({
        found: false,
        jan
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
      count: Number(data.totalResultsAvailable || hits.length),
      avg,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0
    });
  } catch (err) {
    return res.status(500).json({
      error: 'product_api_failed',
      message: String(err?.message || err)
    });
  }
};
