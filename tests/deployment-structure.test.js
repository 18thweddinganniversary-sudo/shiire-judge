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
  assert.match(html, /jan-ocr-core\.js/);
  assert.match(html, /app\.js/);
});

test('all local browser assets referenced by index exist', () => {
  for (const file of ['styles.css', 'decision-engine.js', 'jan-ocr-core.js', 'app.js']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
});

test('camera startup cannot leave the app stuck on the loading state', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /CAMERA_TIMEOUT_MS/);
  assert.match(app, /Promise\.race/);
});
