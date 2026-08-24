module.exports = async (req, res) => {
  try {
    const jan = String(req.query.jan || '').replace(/\D/g, '');

    if (!jan) {
      return res.status(400).json({ error: 'JANコードが不正です' });
    }

    const key = process.env.KEEPA_API_KEY;

    if (!key) {
      return res.status(500).json({
        configured: false,
        error: 'KEEPA_API_KEY_missing'
      });
    }

    const url =
      'https://api.keepa.com/product' +
      '?key=' + encodeURIComponent(key) +
      '&domain=5' +
      '&code=' + encodeURIComponent(jan) +
      '&history=0' +
      '&stats=90';

    const r = await fetch(url, {
      headers: { 'Accept-Encoding': 'gzip' },
      cache: 'no-store'
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        configured: true,
        error: data?.error || 'Keepa API error',
        tokensLeft: data?.tokensLeft ?? null
      });
    }

    const p = Array.isArray(data.products) ? data.products[0] : null;

    if (!p) {
      return res.status(200).json({
        configured: true,
        found: false,
        jan,
        tokensLeft: data.tokensLeft ?? null
      });
    }

    const stats = p.stats || {};
    const cur = Array.isArray(stats.current) ? stats.current : [];
    const avg90 = Array.isArray(stats.avg90) ? stats.avg90 : [];

    const valid = v =>
      Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;

    const newPrice = valid(cur[1]);
    const buyBox = valid(cur[18]);
    const avg90New = valid(avg90[1]);
    const salesRank = valid(cur[3]);

    const newOfferCount = valid(cur[11]);

    const amazonPrice = valid(cur[0]);
    const amazonPresent = amazonPrice !== null && amazonPrice > 0;

    let fbaFee = null;
    if (p.fbaFees) {
      fbaFee =
        valid(p.fbaFees.pickAndPackFee) ??
        valid(p.fbaFees.pickAndPackFeeTax) ??
        null;
    }

    const referralFeePercentage =
      valid(p.referralFeePercentage);

    let signal = '🔴';
    let label = '見送り';

    if (
      newPrice &&
      avg90New &&
      !amazonPresent &&
      (newOfferCount === null || newOfferCount <= 15)
    ) {
      signal = '🟢';
      label = '仕入れ候補';
    }

    return res.status(200).json({
      configured: true,
      found: true,
      jan,
      tokensLeft: data.tokensLeft ?? null,
      product: {
        asin: p.asin || null,
        title: p.title || '',
        brand: p.brand || '',
        monthlySold:
          Number.isFinite(Number(p.monthlySold))
            ? Number(p.monthlySold)
            : null,
        salesRankDrops30:
          Number.isFinite(Number(stats.salesRankDrops30))
            ? Number(stats.salesRankDrops30)
            : null,
        salesRank,
        newPrice,
        buyBox,
        avg90New,
        newOfferCount,
        amazonPresent,
        fbaFee,
        referralFeePercentage,
        signal,
        label
      }
    });
  } catch (e) {
    return res.status(500).json({
      configured: true,
      error: 'keepa_api_failed',
      message: String(e?.message || e)
    });
  }
};
