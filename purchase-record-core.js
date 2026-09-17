(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.PurchaseRecordCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const RESULTS=new Set(['bought','skipped']);
  const VERDICTS=new Set(['GO','見送り','判定不能']);
  const MAX_RECORDS=200;

  function cleanJan(value){
    const jan=String(value==null?'':value).replace(/\D/g,'');
    if(!/^\d{13}$/.test(jan)) throw new Error('invalid jan');
    return jan;
  }

  function cleanCost(value){
    if(value==null||value==='') return null;
    const n=Number(String(value).replace(/,/g,''));
    return Number.isFinite(n)&&n>0?Math.round(n):null;
  }

  function buildRecord(input){
    input=input||{};
    const jan=cleanJan(input.jan);
    const userResult=String(input.userResult||'');
    const appVerdict=String(input.appVerdict||'');
    if(!RESULTS.has(userResult)) throw new Error('invalid userResult');
    if(!VERDICTS.has(appVerdict)) throw new Error('invalid appVerdict');
    const storeCost=cleanCost(input.storeCost);
    if(userResult==='bought'&&storeCost==null) throw new Error('invalid storeCost');
    const recordedAt=Number.isFinite(Number(input.recordedAt))?Number(input.recordedAt):Date.now();
    const productName=String(input.productName||'').trim();
    return {
      id:[recordedAt,jan,userResult].join('-'),
      jan,
      productName,
      storeCost,
      appVerdict,
      userResult,
      recordedAt
    };
  }

  function loadRecords(raw){
    if(Array.isArray(raw)) return raw.slice(0,MAX_RECORDS);
    if(typeof raw!=='string'||!raw) return [];
    try{
      const parsed=JSON.parse(raw);
      return Array.isArray(parsed)?parsed.slice(0,MAX_RECORDS):[];
    }catch(_){ return []; }
  }

  function appendRecord(records,record){
    const list=Array.isArray(records)?records:[];
    return [record].concat(list).slice(0,MAX_RECORDS);
  }

  return { MAX_RECORDS, buildRecord, loadRecords, appendRecord };
});
