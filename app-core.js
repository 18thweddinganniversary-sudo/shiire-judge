(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShiireAppCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_AGE_MS = 6 * 60 * 60 * 1000;

  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function demandText(keepa, now = Date.now()) {
    const sold = number(keepa?.monthlySold);
    const soldAt = number(keepa?.monthlySoldUpdatedAt);
    if (sold !== null && sold >= 0 && soldAt !== null && soldAt <= now + 60_000 && now - soldAt <= MAX_AGE_MS) return `${sold.toLocaleString('ja-JP')}件/月`;
    const drops = number(keepa?.salesRankDrops30);
    if (drops !== null && drops >= 0) return `Rank下降 ${drops.toLocaleString('ja-JP')}回/30日`;
    const rank = number(keepa?.salesRank);
    if (rank !== null && rank > 0) return `ランキング ${rank.toLocaleString('ja-JP')}位`;
    return 'データなし';
  }

  function countText(value, suffix) { const parsed=number(value); return parsed!==null&&parsed>=0?`${parsed.toLocaleString('ja-JP')}${suffix}`:'データなし'; }
  function moneyText(value) { const parsed=number(value); return parsed!==null?`${Math.round(parsed).toLocaleString('ja-JP')}円`:'-'; }

  function needsKeepaRefresh(item, now = Date.now()) {
    const fetchedAt = number(item?.keepaFetchedAt);
    if (!fetchedAt || fetchedAt > now + 60_000 || now - fetchedAt > MAX_AGE_MS) return true;
    if (!item?.keepa) return true;
    for (const timestamp of [item.keepa.productUpdatedAt, item.keepa.offersUpdatedAt]) {
      const parsed=number(timestamp); if(!parsed||parsed>now+60_000||now-parsed>MAX_AGE_MS)return true;
    }
    return item.keepa.offersSuccessful !== true;
  }
  function hasFreshKeepa(item, now=Date.now()){ return !needsKeepaRefresh(item,now); }
  function keepaErrorMessage(status, fallback='Keepa取得エラー'){ return Number(status)===429?'Keepa利用上限のため現在判定できません':fallback; }
  function createInflightGate(){ const active=new Map(); return { get(key){return active.get(String(key))||null;}, set(key,promise){active.set(String(key),promise); return promise;}, clear(key,promise){if(active.get(String(key))===promise)active.delete(String(key));}, has(key){return active.has(String(key));} }; }

  function refreshDisposition(requestedFrom,currentJan,sheetOpen,openAfter){if(!openAfter)return'none';if(requestedFrom===null&&currentJan===null&&!sheetOpen)return'open';if(requestedFrom!==null&&String(requestedFrom)===String(currentJan)&&sheetOpen)return'refresh';return'none'}
  function formatMoneyInput(raw,caret=String(raw||'').length){const source=String(raw||''),safeCaret=Math.max(0,Math.min(source.length,Number(caret)||0)),digitsBefore=source.slice(0,safeCaret).replace(/\D/g,'').length,afterSeparator=safeCaret>0&&/\D/.test(source[safeCaret-1]),digits=source.replace(/\D/g,'').replace(/^0+(?=\d)/,'');if(!digits)return{text:'',caret:0,value:null};const value=Number(digits);if(!Number.isSafeInteger(value)||value<=0)return{text:'',caret:0,value:null};const text=value.toLocaleString('ja-JP');let seen=0,nextCaret=text.length;if(digitsBefore===0)nextCaret=0;else for(let index=0;index<text.length;index+=1){if(/\d/.test(text[index]))seen+=1;if(seen===digitsBefore){nextCaret=index+1;if(afterSeparator)while(nextCaret<text.length&&/\D/.test(text[nextCaret]))nextCaret+=1;break}}return{text,caret:nextCaret,value}}
  function loadItems(raw){try{const parsed=JSON.parse(raw||'[]');if(!Array.isArray(parsed))return[];return parsed.filter(item=>item&&/^\d{8,14}$/.test(String(item.jan||''))).slice(0,30)}catch{return[]}}
  function createRequestGate(){let active=0;return{begin(){active+=1;return active},invalidate(){active+=1},isCurrent(requestId){return requestId===active}}}
  return { MAX_AGE_MS,demandText,countText,moneyText,needsKeepaRefresh,hasFreshKeepa,keepaErrorMessage,createInflightGate,refreshDisposition,formatMoneyInput,loadItems,createRequestGate };
});
