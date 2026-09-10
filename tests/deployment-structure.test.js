const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('production page is self-contained and does not load old deployments', () => {
  assert.doesNotMatch(html, /-[a-z0-9]+-shiire-judge\.vercel\.app/);
  assert.doesNotMatch(html, /document\.write/);
  assert.match(html, /decision-engine\.js/);
  assert.match(html, /app-core\.js/);
  assert.match(html, /jan-ocr-core\.js/);
  assert.match(html, /app\.js/);
});

test('all local browser assets referenced by index exist', () => {
  for (const file of ['styles.css', 'decision-engine.js', 'jan-ocr-core.js', 'app-core.js', 'app.js']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
});

test('production labels and files expose only the current decision source', () => {
  const api = fs.readFileSync(path.join(root, 'api', 'keepa.js'), 'utf8');
  assert.doesNotMatch(html, /🟢安全目安/);
  assert.match(html, /利益条件上の仕入上限/);
  assert.doesNotMatch(api, /signal\s*=|label\s*=/);
  assert.equal(fs.existsSync(path.join(root, 'v9_17_patch.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'api', '_proxy.js')), false);
});

test('camera startup cannot leave the app stuck on the loading state', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /CAMERA_TIMEOUT_MS/);
  assert.match(app, /Promise\.race/);
  assert.match(app, /cameraGeneration/);
});

test('Keepa completion replaces the loading status', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /判定データを更新しました/);
  assert.match(app, /Keepaデータを更新できませんでした/);
});

test('server APIs build upstream requests with the WHATWG URL API', () => {
  for (const file of ['product.js', 'keepa.js', 'related.js']) {
    const source = fs.readFileSync(path.join(root, 'api', file), 'utf8');
    assert.match(source, /new URL\(/, `${file} must use WHATWG URL`);
  }
});

test('HTML, cache keys, decision engine and README use one release version', () => {
  const decision = fs.readFileSync(path.join(root, 'decision-engine.js'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(html, /仕入れ判断 v9\.41/);
  assert.match(html, /\?v=9410/);
  assert.doesNotMatch(html, /\?v=(?!9410)\d+/);
  assert.match(decision, /version: '9\.41'/);
  assert.match(readme, /仕入れ判断 v9\.41/);
  assert.equal(packageJson.version, '9.41.0');
});
