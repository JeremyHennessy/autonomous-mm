// Offline finite rehearsal. No network clients or live adapters.
import {MODEL,requestFixture,validateForecast} from './validator.mjs';
export const WINDOW=Object.freeze({enabled:false,start:0,expires:0});
export const INPUT_RESERVATION=24000, OUTPUT_RESERVATION=512;
export const FIXTURES=Object.freeze([
 {question_id:'SYNTHETIC-NOT-REAL-COIN',source_ids:['SYNTHETIC-SOURCE-COIN'],evidence:'Fictional fair coin: exactly two equally likely outcomes. Event: heads on its next toss.',expected:'forecast',probability:.5},
 {question_id:'SYNTHETIC-NOT-REAL-EMPTY',source_ids:[],evidence:'Fictional event with no evidence or base rate. Explicitly abstain.',expected:'abstain',probability:null},
 {question_id:'SYNTHETIC-NOT-REAL-CONFLICT',source_ids:['SYNTHETIC-SOURCE-A','SYNTHETIC-SOURCE-B'],evidence:'Fictional sources A and B contradict each other: A says event certainly happens; B says certainly not. Neither reliability nor base rate is provided. Do not invent a resolution rule; abstain.',expected:'abstain',probability:null}
].map(f=>Object.freeze({...f,source_ids:Object.freeze(f.source_ids)})));
const ID=JSON.stringify({version:1,fixtures:FIXTURES,model:MODEL,input:24000,output:512,slots:[0,120000,240000],expiry:1200000});
const validWindow=w=>w?.enabled===true&&Number.isSafeInteger(w.start)&&w.start>0&&w.expires===w.start+1200000;
async function boundedCall(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),60000);})]);}finally{clearTimeout(timer);}}
const terminal=s=>['complete','stopped'].includes(s.state);
const ctx=f=>({question_id:f.question_id,source_ids:[...f.source_ids]});
export function requestFor(i){const f=FIXTURES[i];if(!f)throw Error('fixture');const r=requestFixture(ctx(f));r.input.messages[1].content=JSON.stringify({question_id:f.question_id,source_ids:f.source_ids,evidence:f.evidence});return r;}
export class Rehearsal {
 constructor(storage,window=WINDOW,now=Date.now,waitForCall=boundedCall){this.waitForCall=waitForCall;this.s=storage;this.w=Object.freeze({...window});this.now=now;this.disabled=!validWindow(window);this.poisoned=false;this.busy=false;this.ready=this.init();}
 async init(){if(this.disabled)return;try{this.s.sql.exec('CREATE TABLE IF NOT EXISTS rehearsal (id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL)');this.s.transactionSync(()=>{const rows=this.s.sql.exec('SELECT body FROM rehearsal WHERE id=1').toArray();if(!rows.length)this.s.sql.exec('INSERT INTO rehearsal VALUES (1,?)',JSON.stringify({identity:ID,start:this.w.start,expires:this.w.expires,state:'ready',reason:null,next:0,armed:null,alarmReservations:0,last:this.w.start,attempts:[]}));const d=this.read();if(d.attempts.some(a=>a.state==='reserved')){d.state='stopped';d.reason='interrupted';d.armed=null;this.write(d);}});await this.s.sync();const recovered=this.read();if(recovered.state==='waiting'&&(await this.s.getAlarm())!==this.w.start+recovered.next*120000){this.s.transactionSync(()=>{recovered.state='stopped';recovered.reason='uncertain-schedule';recovered.armed=null;this.write(recovered);});await this.s.sync();}if(terminal(this.read()))await this.s.deleteAlarm();}catch{await this.storageFailure();}}
 read(){if(this.poisoned)throw Error('storage');const rows=this.s.sql.exec('SELECT body FROM rehearsal WHERE id=1').toArray();if(rows.length!==1)throw Error('state');const d=JSON.parse(rows[0].body);if(d.identity!==ID||d.start!==this.w.start||d.expires!==this.w.expires||!['ready','waiting','running','complete','stopped'].includes(d.state)||!Number.isInteger(d.next)||d.next<0||d.next>3||!Number.isInteger(d.alarmReservations)||d.alarmReservations<0||d.alarmReservations>2||!Array.isArray(d.attempts)||d.attempts.length>3||!Number.isSafeInteger(d.last)||d.attempts.some((a,i)=>a.fixture!==i||a.inputReserved!==24000||a.outputReserved!==512||!['reserved','passed','failed'].includes(a.state))||d.attempts.filter(a=>a.state==='reserved').length>1)throw Error('state');return d;}
 write(d){this.s.sql.exec('UPDATE rehearsal SET body=? WHERE id=1',JSON.stringify(d));}
 async storageFailure(){this.poisoned=true;try{await this.s.deleteAlarm();}catch{}return {state:'unavailable',reason:'storage',alarmPresent:null};}
 async halt(reason){try{this.s.transactionSync(()=>{const d=this.read();d.state='stopped';d.reason=reason;d.armed=null;this.write(d);});await this.s.sync();await this.s.deleteAlarm();return await this.status();}catch{return this.storageFailure();}}
 async status(){await this.ready;if(this.disabled)return {state:'disabled',alarmPresent:false};if(this.poisoned)return {state:'unavailable',reason:'storage',alarmPresent:null};try{const d=this.read();return {state:d.state,reason:d.reason,attempts:d.attempts.map(a=>({fixture:a.fixture,state:a.state,reason:a.reason??null,usage:a.usage??null,reservedAt:a.reservedAt,finishedAt:a.finishedAt??null})),alarmPresent:(await this.s.getAlarm())!==null};}catch{return this.storageFailure();}}
 async start(ai){return this.run('manual',ai);}
 async alarm(ai){return this.run('alarm',ai);}
 async run(trigger,ai){await this.ready;if(this.disabled||this.poisoned)return this.status();if(this.busy)return {state:'busy'};this.busy=true;try{
  let d=this.read();if(terminal(d)){await this.s.deleteAlarm();return this.status();}
  const now=this.now();if(!Number.isSafeInteger(now)||now<d.last)return await this.halt('clock');if(now>=this.w.expires-60000)return await this.halt('deadline');
  if(trigger==='manual'&&d.next!==0)return this.status();
  if(trigger==='alarm'&&(d.next===0||d.armed!==d.next||now<this.w.start+d.next*120000))return await this.halt('unexpected-alarm');
  if(now<this.w.start)return await this.halt('clock');
  const i=d.next;if(d.attempts.some(a=>a.fixture===i))return await this.halt('duplicate');
  this.s.transactionSync(()=>{d=this.read();d.state='running';d.last=now;d.armed=null;d.attempts.push({fixture:i,state:'reserved',inputReserved:24000,outputReserved:512,reservedAt:now});this.write(d);});await this.s.sync();
  const dispatch=this.now();if(!Number.isSafeInteger(dispatch)||dispatch<now||dispatch>=this.w.expires-60000)return await this.halt('deadline');
  if(!ai||typeof ai.run!=='function')return await this.halt('binding');
  let result,httpStatus;try{ai.lastRequestHttpStatusCode=null;const req=requestFor(i);result=await this.waitForCall(ai.run(req.model,req.input));httpStatus=ai.lastRequestHttpStatusCode;}catch{return await this.halt('provider');}
  const end=this.now();if(!Number.isSafeInteger(end)||end<dispatch||end>=this.w.expires)return await this.halt('deadline');
  const v=validateForecast(result,ctx(FIXTURES[i]),{providerResolved:true,httpStatus});
  const passed=v.ok&&v.value.status===FIXTURES[i].expected&&v.value.probability===FIXTURES[i].probability;
  this.s.transactionSync(()=>{d=this.read();const a=d.attempts[i];if(a.state!=='reserved')throw Error('state');Object.assign(a,{state:passed?'passed':'failed',reason:passed?'expected':v.ok?'expectation':v.reason,finishedAt:end,...(v.ok?{usage:v.usage}:{})});d.last=end;d.next=i+1;d.state=passed?(d.next===3?'complete':'waiting'):'stopped';d.reason=passed?null:a.reason;this.write(d);});await this.s.sync();
  if(!passed||d.next===3){await this.s.deleteAlarm();return this.status();}
  // Reserve scheduling intent before setAlarm. Never repair/re-arm an uncertain set.
  this.s.transactionSync(()=>{d=this.read();if(d.alarmReservations>=2)throw Error('budget');d.alarmReservations++;d.armed=d.next;this.write(d);});await this.s.sync();
  await this.s.setAlarm(this.w.start+d.next*120000);await this.s.sync();return this.status();
 }catch{return await this.halt('storage-or-state');}finally{this.busy=false;}}
}
