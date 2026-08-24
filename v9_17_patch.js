/* 仕入れ判断 v9.20 安定版パッチ
 * UIフリーズ対策
 * 二択判定維持
 * 入力操作を妨げる監視処理を撤去
 */
(function () {
'use strict';

const CFG = {
  version: '9.20',
  MAX_DATA_AGE_MS: 6 * 60 * 60 * 1000,
  MIN_PROFIT: 500,
  MIN_MARGIN: 20,
  MIN_ROI: 20,
  MAX_OFFERS: 15,
  MAX_PRICE_TO_90D: 1.15,
  MIN_PRICE_TO_90D: 0.75
};

function text(x) {
  return String(x ?? '').normalize('NFKC').toLowerCase();
}

function positive(x) {
  x = Number(x);
  return Number.isFinite(x) && x > 0;
}

const GROUPS = {
  beverage: ['コーラ','炭酸','ジュース','飲料','お茶','緑茶','紅茶','コーヒー','水','ウォーター','スポーツドリンク','エナジー','ペットボトル','缶飲料'],
  food: ['食品','菓子','チョコ','キャンディ','スナック','調味料','マヨネーズ','ソース','ドレッシング','レトルト','即席','インスタント','麺','カレー'],
  shoes: ['スニーカー','シューズ','靴','サンダル','ブーツ','ローファー'],
  cleaning: ['洗剤','柔軟剤','漂白','クリーナー','消臭','ファブリーズ','掃除','除菌'],
  beauty: ['化粧','コスメ','シャンプー','トリートメント','洗顔','美容液','クリーム','ローション','ファンデ','リップ'],
  drug: ['医薬','サプリ','ビタミン','目薬','湿布','絆創膏','マスク'],
  apparel: ['キャップ','帽子','シャツ','パンツ','ジャケット','ウェア','衣類','バッグ','財布'],
  electronics: ['家電','電池','バッテリー','充電器','ケーブル','イヤホン','スマホ','カメラ']
};

function shelfGroup(name) {
  const t = text(name);
  let best = null;
  let score = 0;

  for (const [group, words] of Object.entries(GROUPS)) {
    const s = words.reduce(
      (n, w) => n + (t.includes(text(w)) ? 1 : 0),
      0
    );

    if (s > score) {
      score = s;
      best = group;
    }
  }

  return best;
}

function tokens(name) {
  return text(name)
    .replace(/[()（）【】\[\]「」『』・,，.。/／×x]/g, ' ')
    .split(/\s+/)
    .filter(s => s.length >= 2 && !/^\d/.test(s));
}

function packShape(name) {
  const t = text(name);

  const size = t.match(
    /(\d+(?:\.\d+)?)\s*(ml|l|g|kg)/i
  );

  const counts = [
    ...t.matchAll(
      /(?:×|x)\s*(\d{1,3})\s*(本|個|袋|箱|枚|缶|パック|セット|ケース)/gi
    )
  ].map(m => Number(m[1]));

  return {
    unit: size ? size[2].toLowerCase() : null,
    amount: size ? Number(size[1]) : null,
    count: counts.length
      ? counts.reduce((a, b) => a * b, 1)
      : null
  };
}

function shelfMatch(root, cand) {
  if (!root || !cand) return false;

  const rg = shelfGroup(root.name);
  const cg = shelfGroup(cand.name);

  if (rg && cg && rg !== cg) return false;

  if (
    (rg === 'beverage' || rg === 'food') &&
    cg !== rg
  ) return false;

  const rb = text(root.brand);
  const cb = text(cand.brand || cand._brand);

  const rt = tokens(root.name);
  const ct = new Set(tokens(cand.name));

  const overlap = rt.filter(x => ct.has(x)).length;

  const sameBrand =
    rb &&
    cb &&
    (rb.includes(cb) || cb.includes(rb));

  const rs = packShape(root.name);
  const cs = packShape(cand.name);

  const sameUnit =
    !rs.unit ||
    !cs.unit ||
    rs.unit === cs.unit;

  if (rg === 'beverage' || rg === 'food') {
    return sameUnit && (sameBrand || overlap >= 2);
  }

  if (rg === 'shoes') {
    return sameBrand && overlap >= 1;
  }

  return (
    (sameBrand && overlap >= 1) ||
    overlap >= 2
  );
}

function greenGate(x, decision) {

  const k = x?.keepa || {};
  const reasons = [];

  if (!k.asin) {
    reasons.push('ASIN未確定');
  }

  if (
    typeof window.unitRiskV912 === 'function' &&
    window.unitRiskV912(x)
  ) {
    reasons.push('商品単位/ASIN要確認');
  }

  if (
    !positive(k.newPrice) &&
    !positive(k.avg90New)
  ) {
    reasons.push('Amazon価格不足');
  }

  if (
    !positive(k.fbaFee) ||
    !positive(k.referralFeePercentage)
  ) {
    reasons.push('実手数料不足');
  }

  if (k.amazonPresent) {
    reasons.push('Amazon本体在庫あり');
  }

  if (
    Number.isFinite(Number(k.newOfferCount)) &&
    Number(k.newOfferCount) > CFG.MAX_OFFERS
  ) {
    reasons.push('出品者過多');
  }

  const cur = Number(k.newPrice);
  const avg = Number(k.avg90New);

  if (positive(cur) && positive(avg)) {

    const ratio = cur / avg;

    if (
      ratio > CFG.MAX_PRICE_TO_90D ||
      ratio < CFG.MIN_PRICE_TO_90D
    ) {
      reasons.push('価格安定条件外');
    }

  } else {
    reasons.push('90日価格不足');
  }

  const fresh =
    Number(
      x?.keepaFetchedAt ||
      x?.scannedAt ||
      0
    );

  if (
    !fresh ||
    Date.now() - fresh >
      CFG.MAX_DATA_AGE_MS
  ) {
    reasons.push('データ鮮度不足');
  }

  if (!decision) {

    reasons.push('仕入れ値未入力');

  } else {

    if (
      Number(decision.profit) <
      CFG.MIN_PROFIT
    ) {
      reasons.push('利益不足');
    }

    if (
      Number(decision.margin) <
      CFG.MIN_MARGIN
    ) {
      reasons.push('利益率不足');
    }

    if (
      Number(decision.roi) <
      CFG.MIN_ROI
    ) {
      reasons.push('ROI不足');
    }
  }

  return {
    green: reasons.length === 0,
    reasons
  };
}

function applyDecision(x) {

  if (!x) return;

  const gate =
    greenGate(
      x,
      x.decision || null
    );

  x.signal =
    gate.green ? '🟢' : '🔴';

  x.keepaLabel =
    gate.green
      ? '仕入れ候補'
      : '見送り';

  x.v920Reasons =
    gate.reasons;
}

/* --------------------
   UI安定化
-------------------- */

function stabilizeUI() {

  try {

    /* 数字入力を可能にする */
    document
      .querySelectorAll(
        'input[type="number"],input[inputmode="numeric"],input[inputmode="decimal"]'
      )
      .forEach(el => {

        el.style.pointerEvents = 'auto';

        if (
          /cost|buy|price|仕入|原価|qty|数量/i.test(
            `${el.id} ${el.name} ${el.placeholder}`
          )
        ) {
          el.removeAttribute('readonly');
          el.removeAttribute('disabled');
        }

      });

    /* 最終判定表示 */
    const ft =
      document.getElementById('ftitle');

    const fs =
      document.getElementById('fsig');

    if (
      ft &&
      /データ不足|要確認|慎重/.test(
        ft.textContent || ''
      )
    ) {
      ft.textContent = '見送り';
    }

    if (
      fs &&
      fs.textContent &&
      fs.textContent !== '🟢'
    ) {
      fs.textContent = '🔴';
    }

    /* ボタン文言 */
    const nearby =
      document.getElementById(
        'nearbyBtnV82'
      );

    if (nearby) {
      nearby.textContent =
        '同じ棚をチェック';
    }

  } catch (e) {
    console.warn(
      'v9.20 UI stabilize',
      e
    );
  }
}

/* --------------------
   Keepa取得後
-------------------- */

if (
  typeof window.fetchKeepa ===
  'function'
) {

  const original =
    window.fetchKeepa;

  window.fetchKeepa =
    async function (...args) {

      const ret =
        await original.apply(
          this,
          args
        );

      try {

        const j =
          String(args[0] || '');

        const x =
          window.items?.find(v => {

            const a =
              String(v.jan || '');

            return (
              a === j ||
              a === '0' + j ||
              '0' + a === j
            );

          });

        applyDecision(x);

        window.save?.();
        window.render?.();

      } catch (e) {
        console.warn(e);
      }

      setTimeout(
        stabilizeUI,
        50
      );

      return ret;
    };
}

/* --------------------
   利益計算後
-------------------- */

if (
  typeof window.calc ===
  'function'
) {

  const originalCalc =
    window.calc;

  window.calc =
    function (...args) {

      const ret =
        originalCalc.apply(
          this,
          args
        );

      try {

        const x =
          typeof window.item ===
          'function'
            ? window.item()
            : null;

        if (x) {

          applyDecision(x);

          const gate =
            greenGate(
              x,
              x.decision || null
            );

          const fs =
            document.getElementById(
              'fsig'
            );

          const ft =
            document.getElementById(
              'ftitle'
            );

          const why =
            document.getElementById(
              'why'
            );

          if (fs) {
            fs.textContent =
              gate.green
                ? '🟢'
                : '🔴';
          }

          if (ft) {
            ft.textContent =
              gate.green
                ? '仕入れ候補'
                : '見送り';
          }

          if (
            why &&
            !gate.green
          ) {
            why.textContent =
              '🔴 ' +
              gate.reasons.join(' / ');
          }

          window.save?.();

        }

      } catch (e) {
        console.warn(e);
      }

      setTimeout(
        stabilizeUI,
        20
      );

      return ret;
    };
}

/* --------------------
   同じ棚
-------------------- */

let rootShelf = null;

if (
  typeof window.openSheet ===
  'function'
) {

  const originalSheet =
    window.openSheet;

  window.openSheet =
    function (j, ...rest) {

      const ret =
        originalSheet.call(
          this,
          j,
          ...rest
        );

      try {

        const x =
          typeof window.item ===
          'function'
            ? window.item()
            : null;

        if (x) {
          rootShelf = {
            jan: x.jan,
            name: x.name,
            brand: x.brand
          };
        }

      } catch {}

      setTimeout(
        stabilizeUI,
        30
      );

      return ret;
    };
}

if (
  typeof window.renderNearbyV82 ===
  'function'
) {

  const originalNearby =
    window.renderNearbyV82;

  window.renderNearbyV82 =
    function (cs) {

      const root =
        rootShelf ||
        (
          typeof window.item ===
          'function'
            ? window.item()
            : null
        );

      const filtered =
        (Array.isArray(cs) ? cs : [])
          .filter(
            c =>
              shelfMatch(
                root,
                c
              )
          );

      return originalNearby.call(
        this,
        filtered
      );
    };
}

/*
 * MutationObserver は使用しない。
 * 旧版でカメラ・入力操作を重くする
 * 原因候補だったため撤去。
 */

setTimeout(stabilizeUI, 50);
setTimeout(stabilizeUI, 500);
setTimeout(stabilizeUI, 1500);

window.V920 = {
  config: CFG,
  greenGate,
  shelfMatch,
  stabilizeUI
};

console.log(
  '仕入れ判断 v9.20 patch loaded'
);

})();
