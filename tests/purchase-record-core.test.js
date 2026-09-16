'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../purchase-record-core');

test('buildRecord keeps app verdict separate from user purchase result', () => {
  const r = P.buildRecord({
    jan:'4549980616994', productName:'EH-SW68-N', storeCost:10000,
    appVerdict:'GO', userResult:'bought', recordedAt:Date.UTC(2026,8,17,0,0,0)
  });
  assert.equal(r.jan, '4549980616994');
  assert.equal(r.appVerdict, 'GO');
  assert.equal(r.userResult, 'bought');
  assert.equal(r.storeCost, 10000);
  assert.ok(r.id);
});

test('bought requires a positive store cost', () => {
  assert.throws(() => P.buildRecord({ jan:'4549980616994', productName:'x', storeCost:0, appVerdict:'GO', userResult:'bought' }), /storeCost/);
  assert.throws(() => P.buildRecord({ jan:'4549980616994', productName:'x', storeCost:null, appVerdict:'GO', userResult:'bought' }), /storeCost/);
});

test('skipped can be recorded without store cost', () => {
  const r = P.buildRecord({ jan:'4549980616994', productName:'x', storeCost:null, appVerdict:'判定不能', userResult:'skipped' });
  assert.equal(r.userResult, 'skipped');
  assert.equal(r.storeCost, null);
});

test('invalid JAN, verdict, or result is rejected', () => {
  assert.throws(() => P.buildRecord({ jan:'123', productName:'x', userResult:'skipped', appVerdict:'見送り' }), /jan/);
  assert.throws(() => P.buildRecord({ jan:'4549980616994', productName:'x', userResult:'maybe', appVerdict:'見送り' }), /userResult/);
  assert.throws(() => P.buildRecord({ jan:'4549980616994', productName:'x', userResult:'skipped', appVerdict:'BUY' }), /appVerdict/);
});

test('loadRecords tolerates broken storage and appendRecord caps recent history', () => {
  assert.deepEqual(P.loadRecords('{broken'), []);
  let list=[];
  for(let i=0;i<205;i++) list=P.appendRecord(list, P.buildRecord({ jan:'4549980616994', productName:'x', userResult:'skipped', appVerdict:'見送り', recordedAt:i+1 }));
  assert.equal(list.length, 200);
  assert.equal(list[0].recordedAt, 205);
});
