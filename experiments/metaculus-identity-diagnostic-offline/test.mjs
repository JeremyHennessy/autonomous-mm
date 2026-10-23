import {test} from 'node:test';import assert from 'node:assert/strict';import {run} from './runner.mjs';
const c={enabled:true,start:1000,expires:301000};
const good={id:800001,username:'SyntheticIdentityBot',is_bot:true};
const response=(p=good,status=200,ct='application/json')=>new Response(typeof p==='string'?p:JSON.stringify(p),{status,headers:{'content-type':ct}});
function setup(request=()=>response()){let state='ready',records=[],calls=0,now=1001;const d={now:()=>now,claimOnce:async()=>{if(state!=='ready')return false;state='reserved';return true;},persist:async x=>{if(state!=='reserved'&&!(state==='verified'&&x.state==='uncertain'))throw Error('terminal');state=x.state;records.push(structuredClone(x));},getToken:()=> 'synthetic-test-token',request:(...args)=>{calls++;return request(...args);},setTimeout,clearTimeout};return {d,records,get calls(){return calls;},setNow:v=>now=v};}
test('disabled never reads dependencies',async()=>assert.equal((await run(new Proxy({},{get(){throw Error();}}))).state,'disabled'));
for(const [name,request,category,stage,resolved] of [
 ['correct',()=>response(),'match','identity-shape',true],
 ['sync receiver failure',()=>{throw new TypeError('private');},'dispatch-throw','dispatch-invocation',false],
 ['rejected promise',()=>Promise.reject(new TypeError('private')),'fetch-rejected','fetch-await',false],
 ['abort',()=>Promise.reject(new DOMException('private','AbortError')),'fetch-rejected','fetch-await',false],
 ['status getter',()=>({get status(){throw Error('private');}}),'status-extraction-error','status-extraction',true],
 ['redirect',()=>({status:302,redirected:false}),'redirect-response','redirect-extraction',true],
 ['HTML200',()=>response('<html>',200,'text/html'),'content-type','content-type-extraction',true],
 ['HTML403',()=>response('<html>',403,'text/html'),'http-rejected','content-type-extraction',true],
 ['oversized',()=>response('x'.repeat(16385)),'body-limit','body-read',true],
 ['malformed JSON',()=>response('{'),'json-invalid','json-parse',true],
 ['wrong shape',()=>response({id:'800001'}),'identity-shape','identity-shape',true],
 ['wrong identity',()=>response({...good,id:1}),'identity-mismatch','identity-shape',true],
 ['headers getter',()=>({status:200,redirected:false,get headers(){throw Error('private');}}),'content-type-extraction-error','content-type-extraction',true],
 ['body rejects',()=>({status:200,headers:new Headers({'content-type':'application/json'}),body:{getReader(){return {read:()=>Promise.reject(Error('private')),cancel:async()=>{}};}}}),'body-read-error','body-read',true]
])test(name,async()=>{const x=setup(request),v=await run(x.d,c);assert.equal(v.category,category);assert.equal(v.stage,stage);assert.equal(v.fetchResolved,resolved);assert.equal(v.dispatchAttempted,true);assert.equal(x.calls,1);assert.equal((await run(x.d,c)).state,'consumed');assert.equal(x.calls,1);assert(!JSON.stringify(x.records).includes('private'));assert(!JSON.stringify(x.records).includes('synthetic-test-token'));});
test('watchdog consumes and late resolution cannot overwrite terminal',async()=>{let resolve;const x=setup(()=>new Promise(r=>resolve=r));x.d.setTimeout=fn=>setTimeout(fn,1);const v=await run(x.d,c);assert.equal(v.category,'watchdog');const n=x.records.length;resolve(response());await new Promise(r=>setTimeout(r,5));assert.equal(x.records.length,n);assert.equal((await run(x.d,c)).state,'consumed');});
test('expiry and rollback after last diagnostic flush prevent dispatch',async()=>{for(const time of [301000,999]){const x=setup();const persist=x.d.persist;x.d.persist=async r=>{await persist(r);if(r.stage==='dispatch-invocation')x.setNow(time);};const v=await run(x.d,c);assert.equal(x.calls,0);assert.equal(v.dispatchAttempted,false);assert.equal((await run(x.d,c)).state,'storage-unverified');}});
test('storage uncertainty prevents dispatch and restart never retries',async()=>{const x=setup();x.d.persist=async()=>{throw Error('disk');};assert.equal((await run(x.d,c)).state,'storage-unverified');assert.equal(x.calls,0);assert.equal((await run(x.d,c)).state,'consumed');});
test('request fixed, receiver-preserving wrapper works; no profile retained',async()=>{const binding={request(url,init){assert.equal(this,binding);assert.equal(url,'https://www.metaculus.com/api/users/me/');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(init.headers.Cookie,undefined);return response();}};const x=setup((...args)=>binding.request(...args));assert.equal((await run(x.d,c)).state,'verified');assert(!JSON.stringify(x.records).includes('SyntheticIdentityBot'));});

test('expiry during terminal sync downgrades verified observation',async()=>{const x=setup();const save=x.d.persist;x.d.persist=async v=>{await save(v);if(v.state==='verified')x.setNow(c.expires);};assert.equal((await run(x.d,c)).state,'uncertain');assert.equal(x.records.at(-1).category,'clock');});
test('throwing credential getter never dispatches',async()=>{const x=setup();x.d.getToken=()=>{throw Error('private');};const v=await run(x.d,c);assert.equal(v.category,'credential-error');assert.equal(v.dispatchAttempted,false);assert.equal(x.calls,0);});
test('throwing error name getter is safely classified',async()=>{const x=setup(()=>Promise.reject({get name(){throw Error('private');}}));assert.equal((await run(x.d,c)).errorClass,'unreadable');});
test('invalid UTF8 is distinguished from JSON parsing',async()=>{const x=setup(()=>new Response(new Uint8Array([255]),{headers:{'content-type':'application/json'}}));const v=await run(x.d,c);assert.equal(v.category,'body-decode-error');assert.equal(v.parse,'unread');});

test('elapsed wall time enforces watchdog even when timer callback is delayed',async()=>{const x=setup(()=>{x.setNow(6001);return response();});const v=await run(x.d,c);assert.equal(v.category,'watchdog');assert.equal(v.state,'uncertain');});
