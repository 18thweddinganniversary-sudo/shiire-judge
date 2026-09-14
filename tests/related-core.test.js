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

test('a console bundle name containing Joy-Con is still classified as a console', () => {
  const root = {
    jan: '4902370542912',
    brand: '任天堂',
    name: 'Nintendo Switch 本体 (ニンテンドースイッチ) Joy-Con(L) ネオンブルー/(R) ネオンレッド',
  };
  const hits = [
    { jan: '4902370552843', brand: '任天堂', name: '任天堂 Nintendo Switch 2 Proコントローラー BEE-A-FSSKA 1個' },
    { jan: '4902370535723', brand: '任天堂', name: '任天堂 Nintendo Switch専用 Joy-Con充電グリップ' },
    { jan: '4902370548495', brand: '任天堂', name: 'Nintendo Switch 有機EL 本体 ホワイト' },
  ];
  assert.equal(related.productType(root.name), 'game_console');
  assert.deepEqual(related.selectSameShelf(root, hits).map((item) => item.jan), ['4902370548495']);
});

test('food selection rejects a different food type and a mismatched pack count', () => {
  const root = { jan: '4900000000001', brand: 'Example', name: 'Example ドリップコーヒー 8g×10袋入り' };
  const hits = [
    { jan: '4900000000002', brand: 'Example', name: 'Example ドリップコーヒー 8g×10袋入り 深煎り' },
    { jan: '4900000000003', brand: 'Example', name: 'Example ドリップコーヒー 8g×20袋入り' },
    { jan: '4900000000004', brand: 'Example', name: 'Example チョコ 8g×10袋入り' },
  ];

  assert.deepEqual(related.selectSameShelf(root, hits).map((item) => item.jan), ['4900000000002']);
});

test('unknown product types return no candidates instead of brand-wide noise', () => {
  const root = { jan: '4900000000011', brand: 'Example', name: 'Example 商品 ABC-100' };
  const hits = [{ jan: '4900000000012', brand: 'Example', name: 'Example 別商品 XYZ-200' }];

  assert.deepEqual(related.selectSameShelf(root, hits), []);
});

test('beverage packaging parses capacity and multi-stage totals', () => {
  assert.deepEqual(related.parsePackaging('缶コーヒー 185ml×30本×3箱'), {
    unitCapacityMl: 185,
    unitWeightG: null,
    totalUnits: 90,
    outerCount: 3,
  });
  assert.equal(related.parsePackaging('コーヒー 2箱 計60缶').totalUnits, 60);
  assert.equal(related.parsePackaging('コーヒー 30本×3箱').totalUnits, 90);
  assert.equal(related.parsePackaging('コーヒー 3ケース').outerCount, 3);
});

test('same shelf excludes 30, 60, 90 and different capacity beverage packs', () => {
  const root = { jan: '4900000000101', brand: 'Example', name: 'Example 缶コーヒー 185ml×30本' };
  const hits = [
    { jan: '4900000000102', brand: 'Example', name: 'Example 缶コーヒー 185ml×30本 微糖' },
    { jan: '4900000000103', brand: 'Example', name: 'Example 缶コーヒー 185ml 2箱 計60缶' },
    { jan: '4900000000104', brand: 'Example', name: 'Example 缶コーヒー 185ml×30本×3箱' },
    { jan: '4900000000105', brand: 'Example', name: 'Example 缶コーヒー 250ml×30本' },
    { jan: '4900000000106', brand: 'Other', name: 'Other 缶コーヒー 185ml×30本' },
    { jan: '4900000000107', brand: '', name: '缶コーヒー 185ml×30本' },
  ];
  assert.deepEqual(related.selectSameShelf(root, hits).map((item) => item.jan), ['4900000000102']);
});

test('food candidates with ambiguous pack identity are excluded', () => {
  const root = { jan: '4900000000201', brand: 'Example', name: 'Example コーヒー 3ケース' };
  const hits = [{ jan: '4900000000202', brand: 'Example', name: 'Example コーヒー 3ケース' }];
  assert.deepEqual(related.selectSameShelf(root, hits), []);
});

test('every stage in a multi-pack expression contributes to total units', () => {
  assert.equal(related.parsePackaging('飲料 6本×5パック×3箱').totalUnits, 90);
  assert.equal(related.parsePackaging('飲料 6本×3箱').totalUnits, 18);
});

test('food with matching counts but no capacity or weight is excluded', () => {
  const root = { jan: '4900000000301', brand: 'Example', name: 'Example コーヒー 10袋' };
  const hits = [{ jan: '4900000000302', brand: 'Example', name: 'Example コーヒー 10袋' }];
  assert.deepEqual(related.selectSameShelf(root, hits), []);
});
