const test = require('node:test');
const assert = require('node:assert/strict');

const related = require('../related-core');

test('same-shelf selection excludes unrelated Panasonic categories', () => {
  const root = { jan: '4549980869505', brand: 'Panasonic', name: 'パナソニック 全自動コーヒーメーカー NC-A58-K' };
  const hits = [
    { jan: '4549980783438', brand: 'Panasonic', name: 'パナソニック コーヒーメーカー NC-A57-K' },
    { jan: '4549980611944', brand: 'Panasonic', name: 'パナソニック オーブントースター NT-D700-K' },
    { jan: '4550719030325', brand: 'Panasonic', name: 'パナソニック 高周波治療器 EW-RA560-K' },
  ];

  assert.deepEqual(related.selectSameShelf(root, hits).map((item) => item.jan), ['4549980783438']);
});

test('same-shelf selection keeps consoles separate from games and controllers', () => {
  const root = { jan: '4902370550733', brand: 'Nintendo Switch', name: 'Nintendo Switch 本体 ネオンブルー ネオンレッド' };
  const hits = [
    { jan: '4902370548495', brand: 'Nintendo Switch', name: 'Nintendo Switch 有機EL 本体 ホワイト' },
    { jan: '4902370552843', brand: '任天堂', name: 'Nintendo Switch 2 Proコントローラー' },
    { jan: '4902370554298', brand: '任天堂', name: 'Nintendo Switch ゲームソフト リズム天国' },
  ];

  assert.deepEqual(related.selectSameShelf(root, hits).map((item) => item.jan), ['4902370548495']);
});

test('food selection rejects a different food type and a mismatched pack count', () => {
  const root = { jan: '4900000000001', brand: 'Example', name: 'Example ドリップコーヒー 10袋入り' };
  const hits = [
    { jan: '4900000000002', brand: 'Example', name: 'Example ドリップコーヒー 10袋入り 深煎り' },
    { jan: '4900000000003', brand: 'Example', name: 'Example ドリップコーヒー 20袋入り' },
    { jan: '4900000000004', brand: 'Example', name: 'Example チョコ 10袋入り' },
  ];

  assert.deepEqual(related.selectSameShelf(root, hits).map((item) => item.jan), ['4900000000002']);
});

test('unknown product types return no candidates instead of brand-wide noise', () => {
  const root = { jan: '4900000000011', brand: 'Example', name: 'Example 商品 ABC-100' };
  const hits = [{ jan: '4900000000012', brand: 'Example', name: 'Example 別商品 XYZ-200' }];

  assert.deepEqual(related.selectSameShelf(root, hits), []);
});
