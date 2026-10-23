// Offline finite rehearsal. No network clients or live adapters.
import {snapshotCodes} from './diagnostics.mjs';
import {MODEL,requestFixture,validateForecast} from './validator.mjs';
export const WINDOW=Object.freeze({enabled:false,start:0,expires:0});
export const INPUT_RESERVATION=24000, OUTPUT_RESERVATION=512;
export const FIXTURES=Object.freeze([
 {question_id:'SYNTHETIC-NOT-REAL-COIN',source_ids:['SYNTHETIC-SOURCE-COIN'],evidence:'Fictional fair coin: exactly two equally likely outcomes. Event: heads on its next toss.',expected:'forecast',probability:.5},
 {question_id:'SYNTHETIC-NOT-REAL-EMPTY',source_ids:[],evidence:'Fictional event with no evidence or base rate. Explicitly abstain.',expected:'abstain',probability:null},
 {question_id:'SYNTHETIC-NOT-REAL-CONFLICT',source_ids:['SYNTHETIC-SOURCE-A','SYNTHETIC-SOURCE-B'],evidence:'Fictional sources A and B contradict each other: A says event certainly happens; B says certainly not. Neither reliability nor base rate is provided. Do not invent a resolution rule; abstain.',expected:'abstain',probability:null}
].map(f=>Object.freeze({...f,source_ids:Object.freeze(f.source_ids)})));
const ID=JSON.stringify({version:2,fixtures:FIXTURES,model:MODEL,input:24000,output:512,slots:[0,120000,240000],expiry:1200000});
const validWindow=w=>w?.enabled===true&&Number.isSafeInteger(w.start)&&w.start>0&&w.expires===w.start+1200000;
export const WATCHDOG=Symbol('watchdog');
async function boundedCall(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(WATCHDOG),60000);})]);}finally{clearTimeout(timer);}}
const terminal=s=>['complete','stopped'].includes(s.state);
const ctx=f=>({question_id:f.question_id,source_ids:[...f.source_ids]});
export function requestFor(i){const f=FIXTURES[i];if(!f)throw Error('fixture');const r=requestFixture(ctx(f));r.input.messages[1].content=JSON.stringify({question_id:f.question_id,source_ids:f.source_ids,evidence:f.evidence});return r;}
function validatedUsage(result){const u=result?.usage;if(!u||typeof u!=='object'||Array.isArray(u))return null;const values={};for(const k of ['prompt_tokens','completion_tokens','total_tokens']){const d=Object.getOwnPropertyDescriptor(u,k);if(!d||!d.enumerable||!Object.hasOwn(d,'value')||!Number.isSafeInteger(d.value)||d.value<0)return null;values[k]=d.value;}return values.prompt_tokens<=24000&&values.completion_tokens<=512&&values.total_tokens===values.prompt_tokens+values.completion_tokens?values:null;}
export class Rehearsal {
 constructor(storage,window=WINDOW,now=Date.now,waitForCall=boundedCall){this.waitForCall=waitForCall;this.s=storage;this.w=Object.freeze({...window});this.now=now;this.disabled=!validWindow(window);this.poisoned=false;this.busy=false;this.ready=this.init();}
 async init(){if(this.disabled)return;try{this.s.sql.exec('CREATE TABLE IF NOT EXISTS instrumented (id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL)');this.s.transactionSync(()=>{const rows=this.s.sql.exec('SELECT body FROM instrumented WHERE id=1').toArray();if(!rows.length)this.s.sql.exec('INSERT INTO instrumented VALUES (1,?)',JSON.stringify({identity:ID,start:this.w.start,expires:this.w.expires,state:'ready',reason:null,next:0,armed:null,alarmReservations:0,last:this.w.start,attempts:[]}));const d=this.read();if(d.attempts.some(a=>a.state==='reserved')){d.state='stopped';d.reason='interrupted';d.armed=null;this.write(d);}});await this.s.sync();const recovered=this.read();if(recovered.state==='waiting'&&(await this.s.getAlarm())!==this.w.start+recovered.next*120000){this.s.transactionSync(()=>{recovered.state='stopped';recovered.reason='uncertain-schedule';recovered.armed=null;this.write(recovered);});await this.s.sync();}if(terminal(this.read()))await this.s.deleteAlarm();}catch{await this.storageFailure();}}
 read(){if(this.poisoned)throw Error('storage');const rows=this.s.sql.exec('SELECT body FROM instrumented WHERE id=1').toArray();if(rows.length!==1)throw Error('state');const d=JSON.parse(rows[0].body);if(d.identity!==ID||d.start!==this.w.start||d.expires!==this.w.expires||!['ready','waiting','running','complete','stopped'].includes(d.state)||!Number.isInteger(d.next)||d.next<0||d.next>3||!Number.isInteger(d.alarmReservations)||d.alarmReservations<0||d.alarmReservations>2||!Array.isArray(d.attempts)||d.attempts.length>3||!Number.isSafeInteger(d.last)||d.attempts.some((a,i)=>a.fixture!==i||a.inputReserved!==24000||a.outputReserved!==512||!['reserved','passed','failed'].includes(a.state))||d.attempts.filter(a=>a.state==='reserved').length>1)throw Error('state');return d;}
 write(d){this.s.sql.exec('UPDATE instrumented SET body=? WHERE id=1',JSON.stringify(d));}
 async storageFailure(){this.poisoned=true;try{await this.s.deleteAlarm();}catch{}return {state:'unavailable',reason:'storage',alarmPresent:null};}
 async halt(reason){try{this.s.transactionSync(()=>{const d=this.read();for(const a of d.attempts)if(a.state==='reserved'){a.state='failed';a.reason=reason;a.finishedAt=Number.isSafeInteger(this.now())?this.now():null;}d.state='stopped';d.reason=reason;d.armed=null;this.write(d);});await this.s.sync();await this.s.deleteAlarm();return await this.status();}catch{return this.storageFailure();}}
 async status(){await this.ready;if(this.disabled)return {state:'disabled',alarmPresent:false};if(this.poisoned)return {state:'unavailable',reason:'storage',alarmPresent:null};try{const d=this.read();return {state:d.state,reason:d.reason,attempts:d.attempts.map(a=>({fixture:a.fixture,state:a.state,reason:a.reason??null,usage:a.usage??null,reservedAt:a.reservedAt,finishedAt:a.finishedAt??null,dispatchAttempted:a.dispatchAttempted,providerResolved:a.providerResolved,events:a.events,codes:a.codes??null})),alarmPresent:(await this.s.getAlarm())!==null};}catch{return this.storageFailure();}}
 async mark(i,stage,fields={}){this.s.transactionSync(()=>{const d=this.read(),a=d.attempts[i],at=this.now();if(!a||a.state!=='reserved'||a.events.length>=12||!Number.isSafeInteger(at)||at<d.last)throw Error('state');a.events.push({stage,at});Object.assign(a,fields);d.last=at;this.write(d);});await this.s.sync();}
 async markNotDispatched(i,at){this.s.transactionSync(()=>{const d=this.read(),a=d.attempts[i];a.dispatchAttempted=false;a.events.push({stage:'not-dispatched',at:Number.isSafeInteger(at)?at:null});this.write(d);});await this.s.sync();}
 async start(ai){return this.run('manual',ai);}
 async alarm(ai){return this.run('alarm',ai);}
 async run(trigger,ai){await this.ready;if(this.disabled||this.poisoned)return this.status();if(this.busy)return {state:'busy'};this.busy=true;try{
  let d=this.read();if(terminal(d)){await this.s.deleteAlarm();return this.status();}
  const now=this.now();if(!Number.isSafeInteger(now)||now<d.last)return await this.halt('clock');if(now>=this.w.expires-60000)return await this.halt('deadline');
  if(trigger==='manual'&&d.next!==0)return this.status();
  if(trigger==='alarm'&&(d.next===0||d.armed!==d.next||now<this.w.start+d.next*120000))return await this.halt('unexpected-alarm');
  if(now<this.w.start)return await this.halt('clock');
  const i=d.next;if(d.attempts.some(a=>a.fixture===i))return await this.halt('duplicate');
  this.s.transactionSync(()=>{d=this.read();d.state='running';d.last=now;d.armed=null;d.attempts.push({fixture:i,state:'reserved',inputReserved:24000,outputReserved:512,reservedAt:now,dispatchAttempted:false,providerResolved:false,events:[{stage:'reservation',at:now}]});this.write(d);});await this.s.sync();
  const dispatch=this.now();if(!Number.isSafeInteger(dispatch)||dispatch<now||dispatch>=this.w.expires-60000)return await this.halt('deadline');
  let req,run,result;
  await this.mark(i,'request-build');
  try{req=requestFor(i);}catch{return await this.halt('request-build');}
  await this.mark(i,'binding-read');
  try{run=ai?.run;}catch{return await this.halt('binding-read');}
  if(typeof run!=='function')return await this.halt('binding-missing');
  await this.mark(i,'dispatch-invocation',{dispatchAttempted:true});
  // Final authoritative check AFTER the last diagnostic flush. No await before invocation.
  const invokeLedger=this.read(),invokeAt=this.now();
  if(!Number.isSafeInteger(invokeAt)||invokeAt<invokeLedger.last||invokeAt>=this.w.expires-60000){
    await this.markNotDispatched(i,invokeAt);return await this.halt(Number.isSafeInteger(invokeAt)&&invokeAt>=this.w.expires-60000?'deadline-before-dispatch':'clock-before-dispatch');
  }
  let pending;
  try{pending=run.call(ai,req.model,req.input);}catch{await this.mark(i,'dispatch-threw',{codes:snapshotCodes(ai)});return await this.halt('dispatch-threw');}
  // Attach watchdog immediately; it owns both resolution/rejection before any await.
  const settled=this.waitForCall(pending).then(value=>({value}),error=>({error}));
  await this.mark(i,'await-provider');
  const outcome=await settled;
  if(Object.hasOwn(outcome,'error')){const timeout=outcome.error===WATCHDOG;await this.mark(i,timeout?'watchdog-timeout':'await-rejected',{codes:snapshotCodes(ai)});return await this.halt(timeout?'watchdog-timeout':'await-rejected');}
  result=outcome.value;
  await this.mark(i,'provider-resolved',{providerResolved:true});
  // Preserve verified usage BEFORE optional binding status getters can fail.
  let usage;try{usage=validatedUsage(result);}catch{await this.mark(i,'usage-read-threw');return await this.halt('usage-read-threw');}
  await this.mark(i,'usage-extracted',usage?{usage}:{});
  const codes=snapshotCodes(ai);await this.mark(i,'status-extracted',{codes});
  if(codes.statusReadFailed)return await this.halt('status-read');
  const end=this.now();if(!Number.isSafeInteger(end)||end<dispatch||end>=this.w.expires)return await this.halt('deadline');
  await this.mark(i,'validator');
  let v;try{v=validateForecast(result,ctx(FIXTURES[i]),{providerResolved:true,httpStatus:codes.httpStatus});}catch{return await this.halt('validator-threw');}
  const passed=v.ok&&v.value.status===FIXTURES[i].expected&&v.value.probability===FIXTURES[i].probability;
  this.s.transactionSync(()=>{d=this.read();const a=d.attempts[i];if(a.state!=='reserved')throw Error('state');Object.assign(a,{state:passed?'passed':'failed',reason:passed?'expected':v.ok?'expectation':v.reason,finishedAt:end,...(v.ok?{usage:v.usage}:{})});d.last=end;d.next=i+1;d.state=passed?(d.next===3?'complete':'waiting'):'stopped';d.reason=passed?null:a.reason;this.write(d);});await this.s.sync();
  if(!passed||d.next===3){await this.s.deleteAlarm();return this.status();}
  // Reserve scheduling intent before setAlarm. Never repair/re-arm an uncertain set.
  this.s.transactionSync(()=>{d=this.read();if(d.alarmReservations>=2)throw Error('budget');d.alarmReservations++;d.armed=d.next;this.write(d);});await this.s.sync();
  await this.s.setAlarm(this.w.start+d.next*120000);await this.s.sync();return this.status();
 }catch{return await this.halt('storage-or-state');}finally{this.busy=false;}}
}
