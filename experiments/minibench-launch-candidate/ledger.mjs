import {LIMITS} from './launch-limits.mjs';
import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export class Ledger{
 constructor(store,config){this.store=store;this.config=structuredClone(config);this.hash=digest(config);store.transaction(()=>{const old=store.read();if(old){if(old.config!==this.hash)throw Error('config-changed');return;}store.write({config:this.hash,stopped:false,last:config.start,wakes:0,lastWorkWake:null,nextEligibleAt:null,dispatchReservations:0,candidateCursor:0,questions:0,attempts:0,sources:0,days:{},items:{}});});}
 read(){return this.store.read();}
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
 tx(fn){return this.store.transaction(()=>{const s=this.read();const out=fn(s);this.store.write(s);return out;});}
 async flush(){await this.store.flush();}
 clock(s,now){if(!Number.isSafeInteger(now)||now<s.last||now<this.config.start||now>=Math.min(this.config.end,this.config.roundEnd)||s.stopped)throw Error('stop-or-time');s.last=now;return now;}
 recover(){this.tx(s=>{for(const i of Object.values(s.items))if(['ADMITTED','SOURCE_RESERVED','MODEL_RESERVED','SUBMIT_RESERVED'].includes(i.state)){i.state='UNKNOWN';i.reason='restart-consumed';s.stopped=true;}});}
 stop(reason){this.tx(s=>{s.stopped=true;s.reason=reason;});}
}
export function memoryStore(){let value;return {read:()=>structuredClone(value),write:v=>{value=structuredClone(v);},transaction(fn){const before=structuredClone(value);try{return fn();}catch(e){value=before;throw e;}},flush:async()=>{}};}
export function sqliteStore(storage){storage.sql.exec('CREATE TABLE IF NOT EXISTS pilot_ledger(id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL)');return {read(){const rows=[...storage.sql.exec('SELECT state FROM pilot_ledger WHERE id=1')];return rows.length?JSON.parse(rows[0].state):undefined;},write(s){storage.sql.exec('INSERT INTO pilot_ledger VALUES(1,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state',JSON.stringify(s));},transaction:fn=>storage.transactionSync(fn),flush:()=>storage.sync()};}
