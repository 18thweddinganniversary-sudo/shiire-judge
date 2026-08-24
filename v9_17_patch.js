/* 仕入れ判断 v9.15 方針固定パッチ
 * 目的: 二択判定 + 🟢厳格化 + 「近く=同じ棚」ガード
 * Target: v9.14 functions/data model
 */
(function(){
'use strict';

const V915 = {
  version: '9.19',
  MAX_DATA_AGE_MS: 6 * 60 * 60 * 1000,
  MIN_PROFIT: 500,
  MIN_MARGIN: 20,
  MIN_ROI: 20,
  MAX_OFFERS: 15,
  MAX_PRICE_TO_90D: 1.15,
  MIN_PRICE_TO_90D: 0.75,
};

function text(x){ return String(x ?? '').normalize('NFKC').toLowerCase(); }
function finitePositive(x){ x=Number(x); return Number.isFinite(x) && x>0; }

const GROUPS = {
  beverage: ['コーラ','炭酸','ジュース','飲料','お茶','緑茶','紅茶','コーヒー','水','ウォーター','スポーツドリンク','エナジー','ペットボトル','缶飲料'],
  food: ['食品','菓子','チョコ','キャンディ','スナック','調味料','マヨネーズ','ソース','ドレッシング','レトルト','即席','インスタント','麺','カレー'],
  shoes: ['スニーカー','シューズ','靴','サンダル','ブーツ','ローファー'],
  cleaning: ['洗剤','柔軟剤','漂白','クリーナー','消臭','ファブリーズ','掃除','除菌'],
  beauty: ['化粧','コスメ','シャンプー','トリートメント','洗顔','美容液','クリーム','ローション','ファンデ','リップ'],
  drug: ['医薬','サプリ','ビタミン','目薬','湿布','絆創膏','マスク'],
  apparel: ['キャップ','帽子','シャツ','パンツ','ジャケット','ウェア','衣類','バッグ','財布'],
  electronics: ['家電','電池','バッテリー','充電器','ケーブル','イヤホン','スマホ','カメラ'],
};

function shelfGroup(name){
  const t=text(name);
  let best=null, score=0;
  for(const [g,ws] of Object.entries(GROUPS)){
    const s=ws.reduce((n,w)=>n+(t.includes(text(w))?1:0),0);
    if(s>score){score=s;best=g;}
  }
  return best;
}

function packShape(name){
  const t=text(name);
  const size=t.match(/(\d+(?:\.\d+)?)\s*(ml|l|g|kg)/i);
  const counts=[...t.matchAll(/(?:×|x)\s*(\d{1,3})\s*(本|個|袋|箱|枚|缶|パック|セット|ケース)/gi)].map(m=>Number(m[1]));
  return {unit:size?size[2].toLowerCase():null, amount:size?Number(size[1]):null, count:counts.length?counts.reduce((a,b)=>a*b,1):null};
}

function tokens(name){
  return text(name).replace(/[()（）【】\[\]「」『』・,，.。/／×x]/g,' ').split(/\s+/).filter(s=>s.length>=2 && !/^\d/.test(s));
}

function shelfMatch(root,cand){
  if(!root||!cand) return false;
  const rg=shelfGroup(root.name), cg=shelfGroup(cand.name);
  // カテゴリが取れる商品は同一棚グループ必須。食品/飲料は特に越境禁止。
  if(rg && cg && rg!==cg) return false;
  if((rg==='beverage'||rg==='food') && cg!==rg) return false;
  if((rg==='beverage'||rg==='food') && ['apparel','shoes','electronics'].includes(cg)) return false;

  const rb=text(root.brand), cb=text(cand.brand||cand._brand);
  const rt=tokens(root.name), ct=new Set(tokens(cand.name));
  const overlap=rt.filter(x=>ct.has(x)).length;
  const sameBrand=rb && cb && (rb.includes(cb)||cb.includes(rb));
  const rs=packShape(root.name), cs=packShape(cand.name);
  const sameUnit=!rs.unit||!cs.unit||rs.unit===cs.unit;

  if(rg==='beverage'||rg==='food') return sameUnit && (sameBrand || overlap>=2);
  if(rg==='shoes') return sameBrand && overlap>=1;
  return (sameBrand && overlap>=1) || overlap>=2;
}

function greenGate(x, decision){
  const k=x?.keepa||{};
  const reasons=[];
  if(!k.asin) reasons.push('ASIN未確定');
  if(typeof unitRiskV912==='function' && unitRiskV912(x)) reasons.push('商品単位/ASIN要確認');
  if(!finitePositive(k.newPrice) && !finitePositive(k.avg90New)) reasons.push('Amazon価格不足');
  if(!finitePositive(k.fbaFee) || !finitePositive(k.referralFeePercentage)) reasons.push('実手数料不足');
  if(k.amazonPresent) reasons.push('Amazon本体在庫あり');
  if(Number.isFinite(Number(k.newOfferCount)) && Number(k.newOfferCount)>V915.MAX_OFFERS) reasons.push('出品者過多');
  const cur=Number(k.newPrice), avg=Number(k.avg90New);
  if(finitePositive(cur)&&finitePositive(avg)){
    const ratio=cur/avg;
    if(ratio>V915.MAX_PRICE_TO_90D || ratio<V915.MIN_PRICE_TO_90D) reasons.push('価格安定条件外');
  } else reasons.push('90日価格不足');
  const fresh=Number(x?.keepaFetchedAt||x?.scannedAt||0);
  if(!fresh || Date.now()-fresh>V915.MAX_DATA_AGE_MS) reasons.push('データ鮮度不足');
  if(!decision) reasons.push('仕入れ値未入力');
  else {
    if(Number(decision.profit)<V915.MIN_PROFIT) reasons.push('利益不足');
    if(Number(decision.margin)<V915.MIN_MARGIN) reasons.push('利益率不足');
    if(Number(decision.roi)<V915.MIN_ROI) reasons.push('ROI不足');
    /* v9.19: 回転不足だけでは赤にしない。利益条件を満たす場合は少量テスト候補へ */
  }
  return {green: reasons.length===0, reasons};
}

function forceBinaryItem(x){
  if(!x) return;
  const gate=greenGate(x,x.decision||null);
  x.signal=gate.green?'🟢':'🔴';
  x.keepaLabel=gate.green?'仕入れ候補':'見送り';
  x.v915Reasons=gate.reasons;
}

// 現在の履歴を二択化
try{ if(Array.isArray(window.items)){ window.items.forEach(forceBinaryItem); window.save?.(); window.render?.(); } }catch{}

// Keepa取得後も🟡/🟠/⚪を残さない
if(typeof window.fetchKeepa==='function'){
  const old=window.fetchKeepa;
  window.fetchKeepa=async function(...args){
    const ret=await old.apply(this,args);
    try{ const j=String(args[0]); const x=window.items?.find(v=>String(v.jan)===j||String(v.jan)==='0'+j); forceBinaryItem(x); window.save?.(); window.render?.(); }catch{}
    return ret;
  };
}

// 利益計算後に厳格ゲートを再評価
if(typeof window.calc==='function'){
  const old=window.calc;
  window.calc=function(...args){
    const ret=old.apply(this,args);
    try{
      const x=typeof window.item==='function'?window.item():null;
      if(x){
        const g=greenGate(x,x.decision||null);
        const d=x.decision||{};
        const profitOK=Number(d.profit)>=V915.MIN_PROFIT && Number(d.margin)>=V915.MIN_MARGIN && Number(d.roi)>=V915.MIN_ROI;
        const hardReasons=g.reasons.filter(r=>!['回転条件不足'].includes(r));
        const testBuy=!g.green && profitOK && hardReasons.length===0;
        x.signal=g.green?'🟢':(testBuy?'🟡':'🔴'); x.keepaLabel=g.green?'仕入れ候補':(testBuy?'少量テスト':'見送り'); x.v915Reasons=g.reasons;
        if(testBuy){ d.qty=Math.max(1,Math.min(1,Number(d.qty)||1)); x.decision=d; }
        if(window.fsig) fsig.textContent=x.signal;
        if(window.ftitle) ftitle.textContent=g.green?'仕入れ候補':(testBuy?'少量テスト仕入れ':'見送り');
        const res=document.getElementById('result'); if(res) res.className='result '+(g.green?'green':(testBuy?'yellow':'red'));
        const q=document.getElementById('qty'); if(q&&testBuy) q.textContent='仕入れ推奨 1個';
        const why=document.getElementById('why'); if(why){ if(testBuy) why.textContent='🟡 利益条件は合格。回転データが弱いため1個だけテスト'; else if(!g.green) why.textContent='🔴 '+g.reasons.join(' / '); }
        window.save?.(); window.render?.();
      }
    }catch{}
    return ret;
  };
}

// 「近く」は最初に開いた基準商品の棚を固定する
let rootShelf=null;
if(typeof window.openSheet==='function'){
  const old=window.openSheet;
  window.openSheet=function(j,...rest){
    const ret=old.call(this,j,...rest);
    try{ const x=typeof window.item==='function'?window.item():null; if(x&&!rootShelf) rootShelf={jan:x.jan,name:x.name,brand:x.brand}; }catch{}
    return ret;
  };
}

// 候補描画直前に同じ棚だけ残す。数合わせは禁止。
if(typeof window.renderNearbyV82==='function'){
  const old=window.renderNearbyV82;
  window.renderNearbyV82=function(cs){
    const root=rootShelf || (typeof window.item==='function'?window.item():null);
    const filtered=(Array.isArray(cs)?cs:[]).filter(c=>shelfMatch(root,c));
    return old.call(this,filtered);
  };
}

// API結果をキャッシュする前にも棚ガード（関数が存在するv9.14向け）
if(typeof window.loadNearbyV82==='function'){
  // render側で最終防御するため、既存API/token節約ロジックはそのまま利用。
}

window.V915={config:V915,shelfGroup,shelfMatch,greenGate};
})();

/* v9.16 final binary UI + shelf wording hardening */
(function(){
'use strict';

// 1) 既存renderより前に必ず二択へ正規化する。
try{
  if(typeof window.render==='function'){
    const oldRender916=window.render;
    window.render=function(...args){
      try{ if(Array.isArray(window.items)) window.items.forEach(forceBinaryItem); }catch{}
      return oldRender916.apply(this,args);
    };
  }
}catch{}

// 2) 「候補経由」だけroot棚を維持し、通常の商品を開いた時はroot棚を更新。
let nearbyNav916=false;
try{
  if(typeof window.openNearbyV84==='function'){
    const oldNear916=window.openNearbyV84;
    window.openNearbyV84=async function(jan,...rest){
      nearbyNav916=true;
      try{
        const ret=await oldNear916.call(this,jan,...rest);
        // v9.18: 候補カードから取得できた商品は、詳細シートを必ず開く。
        // fetchKeepa(..., true) 側の再オープンに依存しないため、端末差でもタップが確実に効く。
        try{
          const j=String(jan||'').replace(/\D/g,'');
          let found=null;
          if(Array.isArray(window.items)){
            found=window.items.find(v=>{
              const vj=String(v?.jan||'').replace(/\D/g,'');
              return vj===j || vj===('0'+j) || ('0'+vj)===j;
            })||null;
          }
          if(found && typeof window.openSheet==='function'){
            window.openSheet(String(found.jan));
          }
        }catch(e){ console.warn('v9.18 nearby open fallback failed',e); }
        return ret;
      } finally {setTimeout(()=>{nearbyNav916=false},0)}
    };
  }
  if(typeof window.openSheet==='function'){
    const oldSheet916=window.openSheet;
    window.openSheet=function(j,...rest){
      const ret=oldSheet916.call(this,j,...rest);
      try{
        const x=typeof window.item==='function'?window.item():null;
        if(x&&!nearbyNav916) rootShelf={jan:x.jan,name:x.name,brand:x.brand};
      }catch{}
      setTimeout(binaryDom916,0);
      return ret;
    };
  }
}catch{}

function binaryDom916(){
  try{
    // ボタン・見出しを店舗棚の言葉に統一
    const b=document.getElementById('nearbyBtnV82');
    if(b) b.textContent='同じ棚をチェック';
    document.querySelectorAll('#nearbyV82 h4').forEach(e=>e.textContent='近くをチェック 👀');

    // 候補なし文言
    const list=document.getElementById('nearbyListV82');
    if(list && /同シリーズの利益候補|同シリーズ/.test(list.textContent||'')){
      list.innerHTML='<div class="nearMetaV82" style="padding-top:8px">この棚の候補はありません</div>';
    }

    // データ不足は第三状態にせず、見送り理由として赤表示
    const nd=document.getElementById('nodataV75');
    if(nd && getComputedStyle(nd).display!=='none'){
      let reason=(nd.textContent||'').includes('手数料')?'判断材料不足（手数料データ不足）':'判断材料不足（Amazon価格データ不足）';
      nd.style.background='#fff0ef';
      nd.style.color='#8b2d24';
      nd.innerHTML='<b style="color:#b42318">🔴 見送り</b>'+reason;
    }
    const ug=document.getElementById('unitGuardV912');
    if(ug && getComputedStyle(ug).display!=='none'){
      const txt=(ug.textContent||'商品単位・ASIN要確認').replace(/^🔴\s*/, '');
      ug.innerHTML='<b>🔴 見送り</b>'+txt;
    }

    // 詳細結果タイトルも第三状態を作らない
    const ft=document.getElementById('ftitle');
    const fs=document.getElementById('fsig');
    if(ft && /データ不足|要確認|慎重|少量/.test(ft.textContent||'')) ft.textContent='見送り';
    if(fs && fs.textContent!=='🟢') fs.textContent='🔴';

    // 商品カードに残る黄/灰/橙シグナルを赤へ置換（DOM最終防御）
    document.querySelectorAll('*').forEach(el=>{
      if(el.children.length===0){
        const t=(el.textContent||'').trim();
        if(t==='🟡'||t==='🟠'||t==='⚪'||t==='🟤') el.textContent='🔴';
      }
    });
  }catch{}
}

// 元の候補描画後にも棚フィルタ + 文言統一
try{
  if(typeof window.renderNearbyV82==='function'){
    const oldRN916=window.renderNearbyV82;
    window.renderNearbyV82=function(cs){
      const root=rootShelf || (typeof window.item==='function'?window.item():null);
      const filtered=(Array.isArray(cs)?cs:[]).filter(c=>shelfMatch(root,c));
      const ret=oldRN916.call(this,filtered);
      setTimeout(()=>{
        const l=document.getElementById('nearbyListV82');
        if(l && !filtered.length) l.innerHTML='<div class="nearMetaV82" style="padding-top:8px">この棚の候補はありません</div>';
        binaryDom916();
      },0);
      return ret;
    };
  }
}catch{}

// 非同期描画にも追従
try{
  const mo=new MutationObserver(()=>binaryDom916());
  mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
}catch{}
setTimeout(binaryDom916,50);
setTimeout(binaryDom916,500);
setTimeout(binaryDom916,1500);

window.V916={binary:true,shelf:true};

/* v9.17 visual binary hardening: remove residual ambiguous labels */
(function(){
'use strict';
function normalizeBinaryText917(){
  try{
    document.querySelectorAll('*').forEach(el=>{
      if(el.children.length!==0) return;
      const t=(el.textContent||'').trim();
      // Verdict-like legacy labels only. Keep longer diagnostic reasons intact.
      if(t==='要確認' || t==='慎重' || t==='少量なら検討' || t==='データ不足'){
        el.textContent='見送り';
      }
      if(t==='条件未達'){
        el.textContent='🔴 条件未達';
        el.style.color='#b42318';
      }
    });
    // Detail/result panels: any non-green final title is explicitly red.
    const ft=document.getElementById('ftitle');
    const fs=document.getElementById('fsig');
    if(ft && ft.textContent!=='仕入れ候補') ft.textContent='見送り';
    if(fs && fs.textContent!=='🟢') fs.textContent='🔴';
  }catch{}
}
try{
  const mo=new MutationObserver(()=>normalizeBinaryText917());
  mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
}catch{}
setTimeout(normalizeBinaryText917,50);
setTimeout(normalizeBinaryText917,500);
setTimeout(normalizeBinaryText917,1500);
window.V917={binaryVisual:true};
})();

})();
