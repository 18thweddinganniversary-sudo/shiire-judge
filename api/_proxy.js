const UPSTREAM = 'https://shiirejudgev5vercel-1-ek9pf5o75-shiire-judge.vercel.app';

module.exports = async function proxy(req, res, route) {
  try {
    const incoming = new URL(req.url, 'https://local.invalid');
    const target = new URL(route, UPSTREAM);
    for (const [k, v] of incoming.searchParams) target.searchParams.append(k, v);

    const upstream = await fetch(target, {
      method: 'GET',
      headers: { 'accept': 'application/json' },
      cache: 'no-store'
    });
    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({error:'upstream_proxy_failed'}));
  }
};
