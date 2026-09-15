const { parseProduct } = require('../keepa-core');
const { validJan } = require('../jan-ocr-core');
const UPSTREAM_TIMEOUT_MS = 15000;

module.exports = async (req, res) => {
  try {
    const jan = String(req.query.jan || '').replace(/\D/g, '');
    const mode = req.query.mode === 'offers' ? 'offers' : 'basic';
    if (!validJan(jan)) return res.status(400).json({ error: 'JANコードが不正です' });
    const key = process.env.KEEPA_API_KEY;
    if (!key) return res.status(500).json({ configured: false, error: 'KEEPA_API_KEY_missing' });

    const url = new URL('https://api.keepa.com/product');
    url.searchParams.set('key', key);
    url.searchParams.set('domain', '5');
    url.searchParams.set('code', jan);
    url.searchParams.set('history', '0');
    url.searchParams.set('stats', '90');
    url.searchParams.set('update', '1');
    // Marketplace offer pages cost +6 tokens per found page. Normal scanning must
    // stay on the one-product request; only an explicit user refresh asks for them.
    if (mode === 'offers') url.searchParams.set('offers', '20');

    const r = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' }, cache: 'no-store', signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    const data = await r.json();
    const tokenMeta = {
      tokensLeft: data?.tokensLeft ?? null,
      tokensConsumed: data?.tokensConsumed ?? null,
      refillRate: data?.refillRate ?? null,
      refillIn: data?.refillIn ?? null,
      tokenFlowReduction: data?.tokenFlowReduction ?? null,
    };
    if (!r.ok) return res.status(r.status).json({ configured: true, error: data?.error || 'Keepa API error', ...tokenMeta });

    const products = Array.isArray(data.products) ? data.products : [];
    const matches = products.filter((product) => ['eanList', 'upcList', 'gtinList']
      .flatMap((field) => Array.isArray(product?.[field]) ? product[field] : [])
      .map((code) => String(code).replace(/\D/g, '')).includes(jan));
    const p = matches.length === 1 ? matches[0] : null;
    if (!p) return res.status(200).json({ configured: true, found: false, reason: matches.length > 1 ? 'ambiguous_product_code' : 'product_code_mismatch', jan, mode, ...tokenMeta });
    return res.status(200).json({ configured: true, found: true, jan, mode, ...tokenMeta, product: parseProduct(p, 5) });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return res.status(504).json({ configured: true, error: 'keepa_api_timeout' });
    return res.status(500).json({ configured: true, error: 'keepa_api_failed', message: String(e?.message || e) });
  }
};
