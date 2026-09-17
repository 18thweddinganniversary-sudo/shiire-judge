(function(){
  'use strict';
  const P=window.PurchaseRecordCore;
  if(!P)return;
  const $=id=>document.getElementById(id);
  const KEY='sedoriGO.purchaseRecords.v1';

  function janFromSheet(){
    const m=String($('detailMeta')?.textContent||'').match(/\b\d{13}\b/);
    return m?m[0]:'';
  }
  function costFromInput(){
    const raw=String($('costInput')?.value||'').replace(/[^0-9]/g,'');
    const n=Number(raw);
    return Number.isFinite(n)&&n>0?n:null;
  }
  function verdictFromSheet(){
    const text=String($('verdictTitle')?.textContent||'');
    if(text.startsWith('GO')) return 'GO';
    if(text.includes('見送り')) return '見送り';
    return '判定不能';
  }
  function readRecords(){
    try{return P.loadRecords(localStorage.getItem(KEY))}catch(_){return[]}
  }
  function writeRecords(records){
    try{localStorage.setItem(KEY,JSON.stringify(records));return true}catch(_){return false}
  }
  function show(message,kind){
    const el=$('purchaseRecordStatus');
    if(!el)return;
    el.className='purchase-record-status '+(kind||'');
    el.textContent=message;
  }
  function record(userResult){
    try{
      const record=P.buildRecord({
        jan:janFromSheet(),
        productName:String($('detailName')?.textContent||'').trim(),
        storeCost:costFromInput(),
        appVerdict:verdictFromSheet(),
        userResult,
        recordedAt:Date.now()
      });
      const records=P.appendRecord(readRecords(),record);
      if(!writeRecords(records)) throw new Error('storage');
      show(userResult==='bought'?'「買った」を記録しました':'「見送った」を記録しました','ok');
    }catch(e){
      if(userResult==='bought'&&costFromInput()==null){show('「買った」の記録には店頭価格を入力してください','warn');return}
      show('買付け結果を保存できませんでした','warn');
    }
  }

  $('purchaseBought')?.addEventListener('click',()=>record('bought'));
  $('purchaseSkipped')?.addEventListener('click',()=>record('skipped'));
})();
