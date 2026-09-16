const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('production page is self-contained and does not load old deployments', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /fetch\([^)]*vercel|iframe[^>]+vercel/i);
});

test('all local browser assets referenced by index exist', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"?]+)(?:\?[^\"]*)?"/g)) {
    const asset = match[1];
    if (/^(?:https?:|data:|#)/.test(asset)) continue;
    assert.equal(fs.existsSync(path.join(root, asset.replace(/^\//, ''))), true, `${asset} must exist`);
  }
});

test('production labels and files expose only the current decision source', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /decision-engine\.js/);
  assert.doesNotMatch(html, /v9_17_patch|MutationObserver/);
});

test('sedori GO candidate discovery is wired into the same store-judgement page', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /sedori-go-core\.js/);
  assert.match(html, /sedori-go\.js/);
  assert.match(html, /id="candidateSearchButton"/);
  assert.match(html, /id="candidateList"/);
  assert.match(html, /候補を探す/);
});

test('camera startup cannot leave the app stuck on the loading state', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /CAMERA_TIMEOUT_MS/);
  assert.match(app, /finally\{state\.cameraStarting=false/);
});

test('lookups ignore product and Keepa responses from superseded requests', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /state\.requests\.isCurrent\(requestId\)/);
  assert.match(app, /state\.requests\.isCurrent\(activeRequestId\)/);
});

test('Keepa completion replaces loading status and limits are explicit', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /判定データを更新しました/);
  assert.match(app, /Keepa利用上限のため現在判定できません/);
  assert.match(app, /Keepaデータが古いか不足しています/);
});

test('manual Keepa refresh asks for an upstream update without offer pages', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /refresh=1/);
  assert.doesNotMatch(app, /refreshButton[^\n]*mode=offers/);
});

test('server APIs build upstream requests with the WHATWG URL API', () => {
  for (const file of ['product.js', 'keepa.js', 'related.js']) {
    const source = fs.readFileSync(path.join(root, 'api', file), 'utf8');
    assert.match(source, /new URL\(/);
    assert.doesNotMatch(source, /url\.parse\(/);
  }
});

test('HTML, cache keys, decision engine and README use one release version', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const decision = fs.readFileSync(path.join(root, 'decision-engine.js'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const htmlVersion = html.match(/仕入れ判断 v(\d+\.\d+)/)?.[1];
  const decisionVersion = decision.match(/version:\s*'([^']+)'/)?.[1];
  assert.ok(htmlVersion);
  assert.equal(decisionVersion, htmlVersion);
  assert.match(readme, new RegExp(`v${htmlVersion.replace('.', '\\.')}\\b`));
});
