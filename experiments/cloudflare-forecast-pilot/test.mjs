import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pilot,SQLiteStore,CONFIG,CONFIG_HASH,CONFIG_JSON} from './core.mjs';
import handlers,{runWorkersAI,metaculusAdapter} from './handlers.mjs';
function storage(db) { return {sql:{exec(sql,...params) { const q=db.prepare(sql); return {toArray:()=>q.all(...params)};}},transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}; }
// Execute SQL mutations eagerly, matching Durable Objects' synchronous sql.exec.
function sqlStore(db) { const s=storage(db); s.sql.exec=(sql,...params)=>{const q=db.prepare(sql);const rows=q.all(...params);return {toArray:()=>rows};};return new SQLiteStore(s);}
function fixture(path=':memory:') {const db=new DatabaseSync(path);let now=CONFIG.start;const store=sqlStore(db);const p=new Pilot(store,()=>now);return {p,db,store,time:t=>{now=t;},restart:()=>new Pilot(store,()=>now)};}
const id=n=>'SYNTHETIC-NOT-REAL-'+n;
const admit=(f,n)=>f.p.admit({id:id(n),type:'binary',roundId:CONFIG.roundId,roundEnd:CONFIG.roundEnd});
const good=()=>({origin:'mock',ack:'confirmed',probability:.6,inputTokens:10,outputTokens:10});
const effectGood=envelope=>({...good(),envelope});
const infer=(f,n,adapter=async()=>good())=>f.p.inferMock(id(n),'fixture',adapter,{origin:'mock',prompt:'fixture',tokens:10});

test('frozen configuration hash and exact 14-day duration',()=>{assert.equal(createHash('sha256').update(CONFIG_JSON).digest('hex'),CONFIG_HASH);assert.equal(CONFIG.duration,14*86400000);});
test('default handlers and adapters cannot call any binding or network',async()=>{const env=new Proxy({},{get(){throw Error('binding touched');}});assert.equal((await handlers.fetch(new Request('https://invalid.test/enable'),env)).status,503);assert.equal((await handlers.scheduled({},env,{})).status,'disabled');await assert.rejects(runWorkersAI(env,{}));await assert.rejects(metaculusAdapter());});
test('only synthetic binary questions, five new per day and twenty overall',()=>{const f=fixture();assert.throws(()=>f.p.admit({id:'real',type:'binary'}));assert.throws(()=>f.p.admit({id:id('x'),type:'continuous'}));for(let d=0;d<4;d++){f.time(CONFIG.start+d*86400000);for(let n=0;n<5;n++)admit(f,d*5+n);assert.throws(()=>admit(f,'extra'+d),/question-budget/);}f.time(CONFIG.start+4*86400000);assert.throws(()=>admit(f,21),/question-budget/);assert.equal(f.p.snapshot().questions.length,20);});
test('deadline is exclusive and stop survives restart',()=>{const f=fixture();f.time(CONFIG.start+CONFIG.duration);assert.throws(()=>admit(f,0),/deadline/);assert.equal(f.restart().snapshot().stopped,true);const g=fixture();g.p.stop();assert.throws(()=>g.restart().admit({id:id(0),type:'binary'}),/stop/);});
test('invalid time and rollback fail closed',()=>{for(const t of [NaN,Infinity,CONFIG.start-1]){const f=fixture();f.time(t);assert.throws(()=>admit(f,0),/time/);assert.equal(f.p.snapshot().stopped,true);}});
test('five inference attempts per UTC day independently of admissions',async()=>{const f=fixture();for(let i=0;i<5;i++)admit(f,i);f.time(CONFIG.start+86400000);admit(f,5);for(let i=0;i<5;i++)assert.equal(await infer(f,i),true);await assert.rejects(infer(f,5),/attempt-budget/);assert.equal(f.p.snapshot().attempts.length,5);});
test('three sources per question and sixty overall',()=>{const f=fixture();for(let n=0;n<20;n++){f.time(CONFIG.start+Math.floor(n/5)*86400000);admit(f,n);for(let k=0;k<3;k++){const t=f.p.reserve('sources',id(n));assert.equal(f.p.finish(t,{origin:'mock',ack:'confirmed'}),true);}assert.throws(()=>f.p.reserve('sources',id(n)),/source-budget/);}assert.equal(f.p.snapshot().sources.length,60);});
test('atomic reservation precedes mock call and concurrent work is denied',async()=>{const f=fixture();admit(f,0);admit(f,1);let finish;const pending=infer(f,0,()=>new Promise(r=>{finish=r;}));assert.equal(f.p.snapshot().attempts.length,1);await assert.rejects(infer(f,1),/busy/);finish(good());assert.equal(await pending,true);await assert.rejects(infer(f,0),/no-rerun/);});
test('restart on disk retains attempt and halts uncertain inference',()=>{const dir=mkdtempSync(join(tmpdir(),'pilot-'));try{let f=fixture(join(dir,'test.sqlite'));admit(f,0);f.p.reserve('attempts',id(0));f.db.close();f=fixture(join(dir,'test.sqlite'));const s=f.p.snapshot();assert.equal(s.stopped,true);assert.equal(s.attempts.length,1);assert.equal(s.attempts[0].status,'uncertain');assert.throws(()=>f.p.reserve('attempts',id(0)),/interrupted/);f.db.close();}finally{rmSync(dir,{recursive:true});}});
test('failed/auth/quota calls consume attempt, stop and cannot retry',async()=>{for(const message of ['auth','quota','timeout','uncertain']){const f=fixture();admit(f,0);assert.equal(await infer(f,0,async()=>{throw Error(message);}),false);assert.equal(f.p.snapshot().attempts.length,1);assert.equal(f.restart().snapshot().stopped,true);await assert.rejects(infer(f,0));}});
test('token accounting abstains without mock proof, bounds output and rejects actual receipts',async()=>{const f=fixture();admit(f,0);let calls=0;await assert.rejects(f.p.inferMock(id(0),'x',()=>{calls++;},null),/token/);assert.equal(calls,0);assert.equal(f.p.snapshot().attempts.length,0);for(const receipt of [{...good(),outputTokens:2001},{...good(),inputTokens:8001},{...good(),origin:'provider'},{...good(),probability:NaN}]){const g=fixture();admit(g,0);assert.equal(await infer(g,0,async()=>receipt),false);assert.equal(g.p.snapshot().stopped,true);}});
test('stop or deadline during inference rejects result',async()=>{for(const deadline of [false,true]){const f=fixture();admit(f,0);let resolve;const p=infer(f,0,()=>new Promise(r=>{resolve=r;}));if(deadline)f.time(CONFIG.start+CONFIG.duration);else f.p.stop();resolve(good());assert.equal(await p,false);}});
test('no duplicate forecasts/comments and no comment before forecast acknowledgment',async()=>{const f=fixture();admit(f,0);await infer(f,0);await assert.rejects(f.p.effectMock(id(0),'comment',async envelope=>effectGood(envelope)),/forecast-unconfirmed/);assert.equal(await f.p.effectMock(id(0),'forecast',async envelope=>effectGood(envelope)),true);await assert.rejects(f.p.effectMock(id(0),'forecast',async envelope=>effectGood(envelope)),/effect-blocked/);assert.equal(await f.p.effectMock(id(0),'comment',async envelope=>effectGood(envelope)),true);await assert.rejects(f.p.effectMock(id(0),'comment',async envelope=>effectGood(envelope)),/effect-blocked/);});
test('uncertain side-effect acknowledgment is permanently non-retryable',async()=>{const f=fixture();admit(f,0);await infer(f,0);let calls=0;assert.equal(await f.p.effectMock(id(0),'forecast',async()=>{calls++;throw Error('lost ack');}),false);const p=f.restart();await assert.rejects(p.effectMock(id(0),'forecast',async()=>{calls++;return good();}));assert.equal(calls,1);assert.equal(p.snapshot().effects[0].status,'uncertain');});
test('restart recovery covers source and comment reservations too',async()=>{for(const table of ['sources','effects']){const f=fixture();admit(f,0);if(table==='effects')await infer(f,0);f.p.reserve(table,id(0),table==='effects'?'forecast':undefined);assert.equal(f.restart().snapshot()[table][0].status,'uncertain');}});
test('config corruption, malformed state and over-budget ledger fail closed',()=>{for(const mutate of [s=>s.hash='other',s=>s.attempts=Array(25).fill({}),s=>s.last=null,s=>s.sources=Array(61).fill({})]){const f=fixture();const s=f.p.snapshot();mutate(s);f.db.prepare('UPDATE pilot SET body=?').run(JSON.stringify(s));assert.throws(()=>f.restart(),/state/);}});
test('storage failure never invokes adapter',async()=>{let fail=false;const f=fixture();const original=f.store.atomic.bind(f.store);f.store.atomic=fn=>{if(fail)throw Error('storage');return original(fn);};admit(f,0);fail=true;let calls=0;await assert.rejects(infer(f,0,async()=>{calls++;return good();}));assert.equal(calls,0);fail=false;assert.throws(()=>f.p.snapshot(),/storage/);});

test('frozen round rejects moving aliases/mismatch and stops at earlier round close',()=>{const f=fixture();for(const roundId of [undefined,'latest','other-round'])assert.throws(()=>f.p.admit({id:id(0),type:'binary',roundId,roundEnd:CONFIG.roundEnd}),/round-mismatch/);assert.throws(()=>f.p.admit({id:id(0),type:'binary',roundId:CONFIG.roundId,roundEnd:CONFIG.roundEnd+1}),/round-mismatch/);f.time(CONFIG.roundEnd);assert.throws(()=>admit(f,0),/deadline/);assert.ok(CONFIG.roundEnd<CONFIG.start+CONFIG.duration);});
async function capped() {const f=fixture();for(let n=0;n<20;n++){f.time(CONFIG.start+Math.floor(n/5)*86400000);admit(f,n);assert.equal(await infer(f,n),true);assert.equal(await f.p.effectMock(id(n),'forecast',async envelope=>effectGood(envelope)),true);if(n<19)assert.equal(await f.p.effectMock(id(n),'comment',async envelope=>effectGood(envelope)),true);}return f;}
test('twentieth forecast pre-reserves its comment; only that comment survives cap and restart',async()=>{const f=await capped();const s=f.p.snapshot();assert.equal(s.reason,'accepted-limit');assert.equal(s.effects.find(e=>e.finalComment).status,'held');f.p=f.restart();assert.throws(()=>admit(f,20),/accepted-limit/);await assert.rejects(infer(f,19),/accepted-limit/);await assert.rejects(f.p.effectMock(id(19),'forecast',async envelope=>effectGood(envelope)),/accepted-limit/);await assert.rejects(f.p.effectMock(id(18),'comment',async envelope=>effectGood(envelope)),/accepted-limit/);assert.equal(await f.p.effectMock(id(19),'comment',async envelope=>effectGood(envelope)),true);await assert.rejects(f.p.effectMock(id(19),'comment',async envelope=>effectGood(envelope)),/accepted-limit/);assert.equal(f.p.snapshot().effects.filter(e=>e.finalComment&&e.status==='confirmed').length,1);});
test('explicit stop, round deadline and rollback block held final comment without dispatch',async()=>{for(const reason of ['stop','deadline','time']){const f=await capped();if(reason==='stop')f.p.stop();if(reason==='deadline')f.time(CONFIG.roundEnd);if(reason==='time')f.time(CONFIG.start);let calls=0;await assert.rejects(f.p.effectMock(id(19),'comment',async()=>{calls++;return good();}),new RegExp(reason));assert.equal(calls,0);assert.equal(f.p.snapshot().effects.find(e=>e.finalComment).status,'held');}});
test('uncertain final comment is non-retryable after restart',async()=>{const f=await capped();let calls=0;assert.equal(await f.p.effectMock(id(19),'comment',async()=>{calls++;throw Error('auth or lost ack');}),false);f.p=f.restart();await assert.rejects(f.p.effectMock(id(19),'comment',async()=>{calls++;return good();}));assert.equal(calls,1);assert.equal(f.p.snapshot().effects.find(e=>e.finalComment).status,'uncertain');});
test('valid bound final-comment receipt succeeds unless stop, deadline or rollback intervenes',async()=>{for(const reason of ['none','stop','deadline','rollback']){const f=await capped();let resolve,envelope;const pending=f.p.effectMock(id(19),'comment',e=>{envelope=e;return new Promise(r=>{resolve=r;});});assert.ok(envelope);if(reason==='stop')f.p.stop();if(reason==='deadline')f.time(CONFIG.roundEnd);if(reason==='rollback')f.time(CONFIG.start);resolve(effectGood(envelope));assert.equal(await pending,reason==='none');assert.equal(f.p.snapshot().effects.find(e=>e.finalComment).status,reason==='none'?'confirmed':'uncertain');}});

test('read-only reconciliation snapshot works after stop without database writes',()=>{const f=fixture();f.p.stop();const before=f.db.prepare('SELECT total_changes() AS n').get().n;assert.equal(f.p.snapshot().reason,'stop');assert.equal(f.db.prepare('SELECT total_changes() AS n').get().n,before);});

test('every forecast reserves immutable pair before dispatch; next forecast waits for comment',async()=>{
  const f=fixture();for(let n=0;n<2;n++){admit(f,n);await infer(f,n);}
  let observed;
  assert.equal(await f.p.effectMock(id(0),'forecast',async envelope=>{
    observed=structuredClone(envelope);const s=f.p.snapshot();assert.equal(s.effects.length,2);assert.equal(s.effects[1].status,'held');
    assert.equal(s.effects[1].envelope.payload.forecastDigest,envelope.contentDigest);
    assert.equal(createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(envelope).filter(([k])=>k!=='contentDigest')))).digest('hex'),envelope.contentDigest);
    return effectGood(envelope);
  }),true);
  let calls=0;await assert.rejects(f.p.effectMock(id(1),'forecast',async e=>{calls++;return effectGood(e);}),/pair-incomplete/);assert.equal(calls,0);
  f.p=f.restart();assert.deepEqual(f.p.snapshot().effects[0].envelope,observed);
  assert.equal(await f.p.effectMock(id(0),'comment',async e=>effectGood(e)),true);
  assert.equal(await f.p.effectMock(id(1),'forecast',async e=>effectGood(e)),true);
});
test('swapped, stale, altered and unbound effect receipts fail closed without retry',async()=>{
  for(const mutation of ['swap','stale','payload','digest','missing','question','effect']) {
    const f=fixture();for(let n=0;n<2;n++){admit(f,n);await infer(f,n);}
    let old;await f.p.effectMock(id(0),'forecast',async e=>{old=e;return effectGood(e);});
    await f.p.effectMock(id(0),'comment',async e=>effectGood(e));
    let calls=0;
    assert.equal(await f.p.effectMock(id(1),'forecast',async e=>{
      calls++;let bound=structuredClone(e);
      if(mutation==='swap')bound=f.p.snapshot().effects.at(-1).envelope;
      if(mutation==='stale')bound=old;
      if(mutation==='payload')bound.payload.probability=.9;
      if(mutation==='digest')bound.contentDigest='0'.repeat(64);
      if(mutation==='missing')bound=undefined;
      if(mutation==='question')bound.question=id(0);
      if(mutation==='effect')bound.effect='comment';
      return effectGood(bound);
    }),false);
    f.p=f.restart();await assert.rejects(f.p.effectMock(id(1),'forecast',async e=>{calls++;return effectGood(e);}));assert.equal(calls,1);
  }
});
test('disk restart preserves paired comment envelope and interrupted comment cannot retry',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pilot-pair-'));try {
    const path=join(dir,'pair.sqlite');let f=fixture(path);admit(f,0);await infer(f,0);
    await f.p.effectMock(id(0),'forecast',async e=>effectGood(e));const expected=f.p.snapshot().effects[1].envelope;f.db.close();
    f=fixture(path);assert.deepEqual(f.p.snapshot().effects[1].envelope,expected);
    const ticket=f.p.reserve('effects',id(0),'comment');assert.deepEqual(ticket.envelope,expected);f.db.close();
    f=fixture(path);assert.equal(f.p.snapshot().effects[1].status,'uncertain');assert.equal(f.p.snapshot().reason,'interrupted');
    let calls=0;await assert.rejects(f.p.effectMock(id(0),'comment',async e=>{calls++;return effectGood(e);}));assert.equal(calls,0);f.db.close();
  } finally {rmSync(dir,{recursive:true});}
});
test('cap contains nineteen complete pairs and exactly one held final comment, then twenty complete pairs',async()=>{
  const f=await capped();let s=f.p.snapshot();assert.equal(s.effects.length,40);assert.equal(s.effects.filter(e=>e.kind==='comment'&&e.status==='confirmed').length,19);assert.equal(s.effects.filter(e=>e.status==='held').length,1);
  await f.p.effectMock(id(19),'comment',async e=>effectGood(e));s=f.p.snapshot();assert.equal(s.effects.filter(e=>e.status==='confirmed').length,40);
  let calls=0;await assert.rejects(f.p.effectMock(id(20),'forecast',async e=>{calls++;return effectGood(e);}),/accepted-limit/);assert.equal(calls,0);
});
test('persisted payload, link and receipt corruption are rejected on restart',async()=>{
  for(const mutation of ['payload','link','receipt','missing-comment']) {
    const f=fixture();admit(f,0);await infer(f,0);await f.p.effectMock(id(0),'forecast',async e=>effectGood(e));
    const s=f.p.snapshot();if(mutation==='payload')s.effects[0].envelope.payload.probability=.9;
    if(mutation==='link')s.effects[1].envelope.payload.forecastDigest='0'.repeat(64);
    if(mutation==='receipt')s.effects[0].receipt.envelope=s.effects[1].envelope;
    if(mutation==='missing-comment')s.effects.pop();
    f.db.prepare('UPDATE pilot SET body=?').run(JSON.stringify(s));assert.throws(()=>f.restart(),/state/);
  }
});
