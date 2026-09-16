(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SedoriGoCore=api;})(typeof window!=='undefined'?window:null,function(){'use strict';
const CACHE_MAX_AGE_MS=6*60*60*1000;
function positive(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function isFreshCandidateCache(cache,now=Date.now()){if(!cache||!Array.isArray(cache.shortlist))return false;const savedAt=positive(cache.savedAt);if(!savedAt)return false;return now>=savedAt&&now-savedAt<=CACHE_MAX_AGE_MS}
function buildShortlist(details=[]){return (Array.isArray(details)?details:[]).filter(x=>x&&x.found===true&&/^\d{13}$/.test(String(x.jan||''))&&positive(x.preliminarySafeLimit)).map(x=>({...x,decisionLabel:'仕入れ候補',actionLabel:'店頭で確認',needsStoreVerification:true}));}
return{CACHE_MAX_AGE_MS,isFreshCandidateCache,buildShortlist};
});
