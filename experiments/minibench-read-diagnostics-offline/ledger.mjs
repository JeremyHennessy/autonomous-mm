import {safeReadDiagnostic,createReadDiagnostic,READ_ENDPOINTS} from './read-transport-diagnostics.mjs';
import {LIMITS} from './launch-limits.mjs';
import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Optional audited carry-forward only; no automatic migration or reset of an old object.
function priorSpent(config){
 if(!Object.hasOwn(config,'priorSpent'))return null;
 const p=config.priorSpent;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==2||!Object.hasOwn(p,'wakes')||!Object.hasOwn(p,'dispatchReservations')||!Number.isSafeInteger(p.wakes)||!Number.isSafeInteger(p.dispatchReservations)||!((p.wakes===0&&p.dispatchReservations===0)||(p.wakes===1&&p.dispatchReservations===40)))throw Error('prior-spent-config');
 return Object.freeze({wakes:p.wakes,dispatchReservations:p.dispatchReservations});
}
function verifyResidual(s,baseline){
 if(!baseline)return;
 const p=s.priorSpent;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==2||p.wakes!==baseline.wakes||p.dispatchReservations!==baseline.dispatchReservations||!Number.isSafeInteger(s.wakes)||s.wakes<baseline.wakes||s.wakes>LIMITS.workWakes||!Number.isSafeInteger(s.dispatchReservations)||s.dispatchReservations!==s.wakes*LIMITS.dispatchesPerWake||s.dispatchReservations>LIMITS.totalDispatchReservations)throw Error('prior-spent-counter-mismatch');
}
export class Ledger{
 constructor(store,config){this.store=store;this.config=structuredClone(config);this.hash=digest(config);this.baseline=priorSpent(config);store.transaction(()=>{const old=store.read();if(old){if(old.config!==this.hash)throw Error('config-changed');verifyResidual(old,this.baseline);return;}store.write({config:this.hash,stopped:false,last:config.start,...(this.baseline?{priorSpent:{...this.baseline}}:{}),wakes:this.baseline?.wakes??0,lastWorkWake:null,nextEligibleAt:null,dispatchReservations:this.baseline?.dispatchReservations??0,candidateCursor:0,questions:0,attempts:0,sources:0,days:{},items:{}});});}
 read(){return this.store.read();}
 readDiagnostic(value){
  // Read only own data properties; malformed telemetry cannot erase the last safe location.
  const own=(object,key)=>{try{const d=Object.getOwnPropertyDescriptor(object??{},key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
  this.tx(s=>{
   const previous=s.readDiagnostic;const requested=own(value,'endpoint');
   const endpoint=READ_ENDPOINTS.includes(requested)?requested:READ_ENDPOINTS.includes(own(previous,'endpoint'))?previous.endpoint:'metadata';
   // Before any transport exists, metadata is the fixed first planned read; attempted stays false.
   const prior=previous?.endpoint===endpoint?previous:null;
   const safePrior=prior?safeReadDiagnostic({...prior,stage:prior.stage==='pending'?'intent':prior.stage}):null;
   const pending=own(value,'stage')==='pending';const base=pending?createReadDiagnostic(endpoint).snapshot():safePrior??createReadDiagnostic(endpoint).snapshot();
   const candidate={...base};for(const key of Object.keys(base)){const field=own(value,key);if(field!==undefined)candidate[key]=field;}
   candidate.endpoint=endpoint;if(pending)candidate.stage='intent';
   const safe=safeReadDiagnostic(candidate);
   const diagnostic=safe?{...safe}:{...base,stage:'failed',failureStage:base.stage,finalError:'boundary-exception'};
   if(safe&&pending)diagnostic.stage='pending';
   for(const key of ['phase','ordinal']){const incoming=own(value,key),priorValue=own(prior,key);const valid=v=>key==='phase'?['initial','refresh'].includes(v):Number.isSafeInteger(v)&&v>=1&&v<=LIMITS.dispatchesPerWake;const field=valid(incoming)?incoming:valid(priorValue)?priorValue:undefined;if(field!==undefined)diagnostic[key]=field;}
   const failures=['metadata-drift','identity-json','identity-shape','identity-is-spam-missing','identity-required-field-missing','identity-mismatch','discovery-page-shape','discovery-id-shape','clock-or-stop','storage-failed','dispatch-budget','read-interrupted'];
   const failure=own(value,'runnerFailure');if(failures.includes(failure))diagnostic.runnerFailure=failure;else if(failures.includes(own(prior,'runnerFailure')))diagnostic.runnerFailure=prior.runnerFailure;
   s.readDiagnostic=diagnostic;
  });
 }

 limitReason(now){const s=this.read(),day=s.days[new Date(now).toISOString().slice(0,10)]??{};
  if(Object.values(s.items).filter(i=>i.state==='ACKNOWLEDGED').length>=LIMITS.acknowledgedPairs)return 'acknowledged-pair-cap';
  if(s.attempts>=LIMITS.modelAttempts)return 'model-cap';
  if(s.questions>=LIMITS.questions)return 'question-cap';
  if(s.sources>=LIMITS.sources)return 'source-cap';
  if((day.attempts??0)>=LIMITS.dailyModelAttempts)return 'daily-model-cap';
  if((day.questions??0)>=LIMITS.dailyQuestions)return 'daily-question-cap';
  if((s.dispatchReservations??0)+LIMITS.dispatchesPerWake>LIMITS.totalDispatchReservations)return 'global-dispatch-cap';
  if((s.wakes??0)>=LIMITS.workWakes)return 'wake-cap';
  return null;
 }
 tx(fn){return this.store.transaction(()=>{const s=this.read();verifyResidual(s,this.baseline);const out=fn(s);verifyResidual(s,this.baseline);this.store.write(s);return out;});}
 async flush(){await this.store.flush();}
 clock(s,now){if(!Number.isSafeInteger(now)||now<s.last||now<this.config.start||now>=Math.min(this.config.end,this.config.roundEnd)||s.stopped){const error=Error('stop-or-time');error.safeReadFailure='clock-or-stop';throw error;}s.last=now;return now;}
 recover(){this.tx(s=>{if(s.readDiagnostic&&!['complete'].includes(s.readDiagnostic.stage)&&!s.stopped){s.stopped=true;s.reason='read-interrupted';s.readDiagnostic.runnerFailure='read-interrupted';}for(const i of Object.values(s.items))if(['ADMITTED','SOURCE_RESERVED','MODEL_RESERVED','SUBMIT_RESERVED'].includes(i.state)){i.state='UNKNOWN';i.reason='restart-consumed';s.stopped=true;}});}
 stop(reason){this.tx(s=>{s.stopped=true;s.reason=reason;});}
}
export function memoryStore(){let value;return {read:()=>structuredClone(value),write:v=>{value=structuredClone(v);},transaction(fn){const before=structuredClone(value);try{return fn();}catch(e){value=before;throw e;}},flush:async()=>{}};}
export function sqliteStore(storage){storage.sql.exec('CREATE TABLE IF NOT EXISTS pilot_ledger(id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL)');return {read(){const rows=[...storage.sql.exec('SELECT state FROM pilot_ledger WHERE id=1')];return rows.length?JSON.parse(rows[0].state):undefined;},write(s){storage.sql.exec('INSERT INTO pilot_ledger VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state',JSON.stringify(s));},transaction:fn=>storage.transactionSync(fn),flush:()=>storage.sync()};}
