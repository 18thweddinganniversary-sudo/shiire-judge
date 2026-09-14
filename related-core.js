'use strict';

const TYPES = [
  ['game_console', /(?:nintendo\s*)?switch.*(?:本体|lite|有機el)|(?:本体|lite|有機el).*(?:switch|スイッチ)/i, 'ゲーム機本体'],
  ['game_controller', /joy[\s-]?con|コントローラ|プロコン/i, 'ゲーム周辺機器'],
  ['game_software', /ゲームソフト|ソフト\s|\sソフト|hac-p|bee-p|edition|リズム天国|マリオカート|ルイージマンション/i, 'ゲームソフト'],
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
  return parsePackaging(name).totalUnits;
}

function parsePackaging(name) {
  const source = normalize(name).replace(/,/g, '');
  const capacity = source.match(/(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/i);
  const capacityValue = Number(capacity?.[1]);
  const capacityUnit = capacity?.[2]?.toLowerCase();
  const unitCapacityMl = capacityUnit === 'ml' ? capacityValue : capacityUnit === 'l' ? capacityValue * 1000 : null;
  const unitWeightG = capacityUnit === 'g' ? capacityValue : capacityUnit === 'kg' ? capacityValue * 1000 : null;
  const explicitTotal = source.match(/計\s*(\d{1,4})\s*(?:本|缶|個|袋|枚|パック|点)/);
  const tokens = [...source.matchAll(/(\d{1,4})\s*(本|缶|個|袋|枚|パック|点|箱|ケース|セット)(?!\s*(?:あたり|当たり))/g)]
    .map((match) => ({ count: Number(match[1]), unit: match[2] }))
    .filter(({ count }) => count >= 1 && count <= 1000);
  const baseTokens = tokens.filter(({ unit }) => /^(?:本|缶|個|袋|枚|パック|点)$/.test(unit));
  const outerMatches = [...source.matchAll(/(?:×|x)?\s*(\d{1,3})\s*(箱|ケース|セット)(?:入り|入)?/g)];
  const outerCount = outerMatches.length
    ? outerMatches.map((match) => Number(match[1])).filter((count) => count >= 1 && count <= 100).reduce((total, count) => total * count, 1)
    : null;
  let totalUnits = Number(explicitTotal?.[1]) || null;
  if (!totalUnits && baseTokens.length) {
    totalUnits = /[×x]/i.test(source)
      ? tokens.reduce((total, token) => total * token.count, 1)
      : baseTokens[0].count * (outerCount || 1);
  }
  if (totalUnits !== null && (totalUnits < 1 || totalUnits > 10000)) totalUnits = null;
  return {
    unitCapacityMl: Number.isFinite(unitCapacityMl) && unitCapacityMl > 0 ? unitCapacityMl : null,
    unitWeightG: Number.isFinite(unitWeightG) && unitWeightG > 0 ? unitWeightG : null,
    totalUnits,
    outerCount,
  };
}

function samePackaging(rootName, candidateName) {
  const root = parsePackaging(rootName);
  const candidate = parsePackaging(candidateName);
  if (root.totalUnits === null || candidate.totalUnits === null || root.totalUnits !== candidate.totalUnits) return false;
  const rootMeasure = root.unitCapacityMl ?? root.unitWeightG;
  const candidateMeasure = candidate.unitCapacityMl ?? candidate.unitWeightG;
  if (rootMeasure === null || candidateMeasure === null) return false;
  for (const field of ['unitCapacityMl', 'unitWeightG', 'outerCount']) {
    if ((root[field] !== null || candidate[field] !== null) && root[field] !== candidate[field]) return false;
  }
  return true;
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
  const seen = new Set();
  return (Array.isArray(hits) ? hits : [])
    .filter((item) => /^\d{13}$/.test(String(item.jan || '')))
    .filter((item) => item.jan !== root.jan && !seen.has(item.jan) && seen.add(item.jan))
    .filter((item) => productType(item.name) === type)
    .filter((item) => !root.brand || (item.brand && normalize(item.brand) === normalize(root.brand)))
    .filter((item) => !FOOD_TYPES.has(type) || samePackaging(root.name, item.name))
    .map((item, index) => ({ ...item, matchLabel: typeLabel(type), _score: score(root, item, type), _index: index }))
    .sort((a, b) => b._score - a._score || a._index - b._index)
    .slice(0, limit)
    .map(({ _score, _index, ...item }) => item);
}

function buildSearchQuery(root) {
  const label = typeLabel(productType(root?.name));
  return [String(root?.brand || '').trim(), label].filter(Boolean).join(' ');
}

module.exports = { productType, packCount, parsePackaging, samePackaging, selectSameShelf, buildSearchQuery };
