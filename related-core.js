'use strict';

const TYPES = [
  ['game_controller', /joy[\s-]?con|コントローラ|プロコン/i, 'ゲーム周辺機器'],
  ['game_software', /ゲームソフト|ソフト\s|\sソフト|hac-p|bee-p|edition|リズム天国|マリオカート|ルイージマンション/i, 'ゲームソフト'],
  ['game_console', /(?:nintendo\s*)?switch.*(?:本体|lite|有機el)|(?:本体|lite|有機el).*(?:switch|スイッチ)/i, 'ゲーム機本体'],
  ['coffee_machine', /コーヒーメーカー|コーヒーマシン/i, 'コーヒーメーカー'],
  ['toaster', /トースター/i, 'トースター'],
  ['recorder', /レコーダー|diga|ディーガ/i, 'レコーダー'],
  ['player', /ブルーレイ.*プレーヤー|dvd.*プレーヤー/i, 'プレーヤー'],
  ['shaver', /シェーバー|ラムダッシュ/i, 'シェーバー'],
  ['treatment', /治療器|コリコラン/i, '治療器'],
  ['shower_head', /シャワーヘッド/i, 'シャワーヘッド'],
  ['etc_device', /etc(?:2\.0)?車載器/i, 'ETC車載器'],
  ['food_coffee', /コーヒー|珈琲/i, 'コーヒー食品'],
  ['food_tea', /紅茶|緑茶|茶葉|お茶/i, 'お茶・紅茶'],
  ['food_chocolate', /チョコ/i, 'チョコレート'],
  ['food_snack', /スナック|せんべい|クッキー|キャンディ|菓子/i, '菓子'],
  ['food_seasoning', /調味料|ソース|ドレッシング|マヨネーズ/i, '調味料'],
  ['food_instant', /レトルト|即席|インスタント/i, '即席食品'],
];

const FOOD_TYPES = new Set(TYPES.map(([type]) => type).filter((type) => type.startsWith('food_')));

function normalize(value) {
  return String(value || '').normalize('NFKC').toLowerCase();
}

function productType(name) {
  const source = normalize(name);
  return TYPES.find(([, pattern]) => pattern.test(source))?.[0] || null;
}

function typeLabel(type) {
  return TYPES.find(([candidate]) => candidate === type)?.[2] || '';
}

function packCount(name) {
  const source = normalize(name);
  const match = source.match(/(?:×|x)\s*(\d{1,3})\s*(?:本|個|袋|箱|枚|缶|パック|セット|ケース|点)|(?:^|\D)(\d{1,3})\s*(?:本|個|袋|箱|枚|缶|パック|点)\s*(?:入り|入|セット)/i);
  const count = Number(match?.[1] || match?.[2]);
  return count >= 1 && count <= 200 ? count : null;
}

function modelFamilies(name) {
  return [...normalize(name).toUpperCase().matchAll(/\b([A-Z]{2,}(?:-[A-Z]{1,4})?)-?\d[A-Z0-9-]*\b/g)]
    .map((match) => match[1]);
}

function score(root, candidate, type) {
  let value = normalize(candidate.brand) === normalize(root.brand) ? 2 : 0;
  const rootFamilies = new Set(modelFamilies(root.name));
  if (modelFamilies(candidate.name).some((family) => rootFamilies.has(family))) value += 4;
  if (normalize(candidate.name).includes(normalize(root.brand))) value += 1;
  if (FOOD_TYPES.has(type) && packCount(root.name) === packCount(candidate.name)) value += 3;
  return value;
}

function selectSameShelf(root, hits, limit = 10) {
  const type = productType(root?.name);
  if (!type) return [];
  const rootPack = packCount(root.name);
  const seen = new Set();
  return (Array.isArray(hits) ? hits : [])
    .filter((item) => /^\d{13}$/.test(String(item.jan || '')))
    .filter((item) => item.jan !== root.jan && !seen.has(item.jan) && seen.add(item.jan))
    .filter((item) => productType(item.name) === type)
    .filter((item) => !FOOD_TYPES.has(type) || (rootPack !== null && packCount(item.name) === rootPack))
    .map((item, index) => ({ ...item, matchLabel: typeLabel(type), _score: score(root, item, type), _index: index }))
    .sort((a, b) => b._score - a._score || a._index - b._index)
    .slice(0, limit)
    .map(({ _score, _index, ...item }) => item);
}

function buildSearchQuery(root) {
  const label = typeLabel(productType(root?.name));
  return [String(root?.brand || '').trim(), label].filter(Boolean).join(' ');
}

module.exports = { productType, packCount, selectSameShelf, buildSearchQuery };
