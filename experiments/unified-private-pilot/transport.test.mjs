import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransport} from './transport.mjs';
const origin = 'https://www.metaculus.com';
const response = (body, status=200, type='application/json') => new Response(body,{status,headers:{'content-type':type}});
const descriptor = {digest:'a'.repeat(64),bodyJson:JSON.stringify({forecasts:[{question:12,probability_yes:.5}],comments:[{on_post:34,text:'Reason',is_private:true,included_forecast:true}]})};
function fixture(handler, options={}) {
  const calls=[];
  const transport=createTransport({fetch:(url,init)=>{calls.push({url,init});return handler(url,init,calls.length);},getToken:async()=> 'SECRET',tournamentSlug:'frozen-round-2026',sourceAllowlist:[{host:'data.example.org',pathPrefix:'/release/'}],now:()=>100,...options});
  return {transport,calls};
}
test('factory never falls back to global network and rejects moving round aliases',()=>{
  assert.throws(()=>createTransport({getToken:()=> 'x', tournamentSlug:'frozen'}));
  for(const tournamentSlug of ['current','latest','active','https://evil']) assert.throws(()=>fixture(()=>{}, {tournamentSlug}));
});
test('fixed read paths, separate ID namespaces and exact auth header',async()=>{
  const {transport,calls}=fixture(()=>response('{}'));
  await transport.detail(34); await transport.history(12);
  assert.equal(calls[0].url,origin+'/api/posts/34/');
  assert.equal(calls[1].url,origin+'/api/questions/bulk-forecast-read/?question_ids=12');
  for(const {init} of calls){assert.equal(init.redirect,'manual');assert.equal(init.credentials,undefined);assert.equal(init.referrerPolicy,undefined);assert.equal(init.headers.Authorization,'Token SECRET');assert.deepEqual(Object.keys(init.headers),['Accept','Authorization']);}
  await assert.rejects(()=>transport.detail('34'));
});
test('bounded discovery verifies next cursor but never uses arbitrary URLs',async()=>{
  const next=origin+'/api/posts/?offset=1&limit=1&include_descriptions=true&forecast_type=binary&statuses=open&tournaments=frozen-round-2026';
  const {transport,calls}=fixture((u,i,n)=>response(JSON.stringify({results:[{id:n}],previous:null,next:n===1?next:null})),{pageSize:1});
  assert.deepEqual(await transport.discover(),{pages:[{results:[{id:1}],previous:null,next},{results:[{id:2}],previous:null,next:null}],traversalComplete:true,snapshotConsistent:false});
  assert.equal(calls.length,2); assert.match(calls[1].url,/offset=1$/);
});
test('hostile cursors and exhausted pagination fail closed without partial success',async()=>{
  for(const next of ['https://evil.example/api/posts/?x=1','/api/posts/?offset=1',false]){
    const {transport,calls}=fixture(()=>response(JSON.stringify({results:[{}],previous:null,next})));
    await assert.rejects(()=>transport.discover());assert.equal(calls.length,1);
  }
  const next=origin+'/api/posts/?tournaments=frozen-round-2026&statuses=open&forecast_type=binary&include_descriptions=true&limit=100&offset=100';
  const {transport,calls}=fixture(()=>response(JSON.stringify({results:[{}],previous:null,next})),{maxPages:1});
  await assert.rejects(()=>transport.discover(),/pagination-limit/);assert.equal(calls.length,1);
});
test('atomic exact201 empty object is correlated only to local digest and has no invented IDs',async()=>{
  const {transport,calls}=fixture(()=>response('{}',201));
  assert.deepEqual(await transport.submit(descriptor),{state:'ACKNOWLEDGED',requestDigest:descriptor.digest,httpStatus:201,receivedAt:100,retryAllowed:false});
  assert.equal(calls.length,1);assert.equal(calls[0].url,origin+'/api/questions/bulk-forecast-comment/');assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.body,descriptor.bodyJson);
});
test('all uncertain submission results remain UNKNOWN and never retry',async()=>{
  for(const handler of [()=>response('{}',200),()=>response('{"id":1}',201),()=>response('{}',302),()=>response('bad',201),()=>{throw Error('SECRET')},()=>response('{"a":1,"a":2}',201)]){
    const {transport,calls}=fixture(handler);const result=await transport.submit(descriptor);
    assert.equal(result.state,'UNKNOWN');assert.equal(result.retryAllowed,false);assert.equal(calls.length,1);assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});
test('invalid or public/separate-write body never dispatches',async()=>{
  const {transport,calls}=fixture(()=>response('{}',201));
  for(const bodyJson of ['{}', descriptor.bodyJson.replace('"is_private":true','"is_private":false'),descriptor.bodyJson.replace('"probability_yes":0.5','"probability_yes":1')]) assert.equal((await transport.submit({...descriptor,bodyJson})).state,'UNKNOWN');
  assert.equal(calls.length,0);
});
test('final synchronous dispatch guard runs after token and directly before fetch',async()=>{
  const sequence=[];
  const {transport}=fixture(()=>{sequence.push('fetch');return response('{}')},{getToken:async()=>{sequence.push('token');return 'SECRET'},beforeDispatch:()=>sequence.push('guard')});
  await transport.detail(1);assert.deepEqual(sequence,['token','guard','fetch']);
  const blocked=fixture(()=>response('{}'),{beforeDispatch:()=>{throw Error('stop')}});
  await assert.rejects(()=>blocked.transport.detail(1));assert.equal(blocked.calls.length,0);
  const asyncGuard=fixture(()=>response('{}'),{beforeDispatch:async()=>{}});
  await assert.rejects(()=>asyncGuard.transport.detail(1));assert.equal(asyncGuard.calls.length,0);
});
test('source exact allowlist, path controls, and no auth or token read',async()=>{
  const {transport,calls}=fixture(()=>response('a,b\n1,2',200,'text/csv'),{getToken:()=>{throw Error('must not read')}});
  const result=await transport.source('https://data.example.org/release/file.csv');
  assert.equal(result.text,'a,b\n1,2');assert.deepEqual(calls[0].init.headers,{Accept:'application/json, text/plain, text/csv'});
  for(const url of ['http://data.example.org/release/a','https://data.example.org:443/release/a','https://me@data.example.org/release/a','https://data.example.org/release/a?q=https://evil','https://data.example.org/release/../secret','https://data.example.org/release/%2e%2e/secret','https://data.example.org/release/https://evil','https://127.0.0.1/release/a','https://[::1]/release/a','https://data.example.org.evil/release/a','https://data.example.org/other/a']) await assert.rejects(()=>transport.source(url),/source-url/);
  assert.equal(calls.length,1);
});
test('source rules are frozen copies and caller options cannot inject auth or body',async()=>{
  const rules=[{host:'data.example.org',pathPrefix:'/release/'}];
  const {transport,calls}=fixture(()=>response('fine',200,'text/plain'),{sourceAllowlist:rules});
  rules[0].host='evil.example';
  await transport.source('https://data.example.org/release/file',{auth:true,method:'POST',body:'evil'});
  assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.body,undefined);assert.equal(calls[0].init.headers.Authorization,undefined);
  await assert.rejects(()=>transport.source('https://evil.example/release/file'));
});
test('reject redirects, unsupported types, malformed UTF8, duplicate JSON and oversized bodies',async()=>{
  for(const handler of [()=>response('',302),()=>response('<script/>',200,'text/html'),()=>response('{"x":1,"x":2}'),()=>response(new Uint8Array([255])),()=>response('x'.repeat(11))]){
    const {transport}=fixture(handler,{maxBytes:10});await assert.rejects(()=>transport.detail(1));
  }
});
test('incremental stream overflow cancels and stalled body timeout never retries',async()=>{
  let cancelled=false;
  const overflow=fixture(()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}),{maxBytes:10});
  await assert.rejects(()=>overflow.transport.detail(1));assert.equal(cancelled,true);
  const stalled=fixture(()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});}}),{status:201,headers:{'content-type':'application/json'}}),{timeoutMs:10});
  assert.equal((await stalled.transport.submit(descriptor)).state,'UNKNOWN');assert.equal(stalled.calls.length,1);
});
test('timeout while awaiting token does not permit delayed dispatch',async()=>{
  let resolveToken;
  const {transport,calls}=fixture(()=>response('{}'),{timeoutMs:5,getToken:()=>new Promise(resolve=>{resolveToken=resolve;})});
  await assert.rejects(()=>transport.detail(1));resolveToken('SECRET');await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls.length,0);
});
test('false guard and clock rollback fail closed',async()=>{
  const veto=fixture(()=>response('{}'),{beforeDispatch:()=>false});
  await assert.rejects(()=>veto.transport.detail(1));assert.equal(veto.calls.length,0);
  let times=0;
  const rollback=fixture(()=>response('{}',201),{now:()=>++times===1?100:99});
  assert.equal((await rollback.transport.submit(descriptor)).state,'UNKNOWN');assert.equal(rollback.calls.length,1);
});
