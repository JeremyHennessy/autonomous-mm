// OFFLINE only: dependency-injected synthetic adapters, no default transport or model.
import {parseStrictJSON} from './deps/strict-json.mjs';
import {evaluate,sha256} from './deps/gate.mjs';
import {normalizePost} from './deps/provider-shape.mjs';
import {compatibleRequest} from './deps/provider-contract.mjs';
import {normalizeBinding} from './deps/transport.mjs';
import {validateForecast} from './deps/validator.mjs';
import {makeDescriptor,acknowledge,reconcile} from './deps/contract.mjs';
async function bounded(p,ms=50){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),ms);})]);}finally{clearTimeout(timer);}}
const out=(state,reason)=>({synthetic:true,liveUseAllowed:false,state,reason});
const read=o=>{if(o?.state!=='value')throw Error('provider-observation');return o.value;};
function admit(f,c,now){
 if(f.synthetic!==true||f.participation!==true||f.primaryBot!==true)throw Error('synthetic-attestations');
 const v=evaluate(JSON.stringify({...f.gate,now:new Date(now).toISOString()}),c.protocolDigest);
 if(!v.batchValid||v.results.length!==1||!v.results[0].eligible)throw Error('ineligible');
 const r=f.gate.snapshot.pages[0].records[0],n=normalizePost(JSON.stringify(f.raw));if(!n.shapeReadable)throw Error('provider-shape');const p=n.observation,q=read(p.question);
 for(const [a,b] of [[read(p.id),r.postId],[read(q.id),r.questionId],[read(q.postId),r.postId],[read(p.status),'open'],[read(p.curationStatus),'approved'],[read(q.status),'open'],[read(q.type),'binary'],[read(q.description),r.criteria.description],[read(q.resolutionCriteria),r.criteria.resolutionCriteria],[read(q.finePrint),r.criteria.finePrint],[read(q.openTime),r.opensAt],[read(q.actualCloseTime),r.closesAt],[read(q.scheduledCloseTime),r.scheduledClosesAt],[read(q.actualResolveTime),r.resolvesAt],[read(q.scheduledResolveTime),r.scheduledResolvesAt]])if(a!==b)throw Error('observation-mismatch');
 if(!read(read(p.projects).tournament).some(x=>read(x.id)===r.roundProjectId&&read(x.slug)==='fictional-round'))throw Error('round');
 if(Object.values(p.otherContent).some(x=>x.state!=='missing'))throw Error('other-content');
 // Missing content alone is NOT standalone proof: explicit synthetic gate assertion above is required.
 return r;
}
export class Pipeline{
 constructor(db,config,deps){this.db=db;this.c=structuredClone(config);this.d=deps;this.hash=sha256(this.c);if(config.synthetic!==true||!Number.isSafeInteger(config.start)||!Number.isSafeInteger(config.end)||config.end<=config.start||config.end-config.start>14*86400000)throw Error('config');db.exec('CREATE TABLE IF NOT EXISTS rehearsal(id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL)');const row=db.prepare('SELECT state FROM rehearsal WHERE id=1').get();if(row){if(JSON.parse(row.state).config!==this.hash)throw Error('config-changed');}else db.prepare('INSERT INTO rehearsal VALUES(1,?)').run(JSON.stringify({config:this.hash,stopped:false,last:config.start,questions:0,attempts:0,sources:0,days:{},items:{}}));}
 status(){return JSON.parse(this.db.prepare('SELECT state FROM rehearsal WHERE id=1').get().state);}
 tx(fn){this.db.exec('BEGIN IMMEDIATE');try{const s=this.status(),v=fn(s);this.db.prepare('UPDATE rehearsal SET state=? WHERE id=1').run(JSON.stringify(s));this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 clock(s){const now=this.d.now();if(!Number.isSafeInteger(now)||now<s.last||now<this.c.start||now>=this.c.end)throw Error('clock');s.last=now;if(s.stopped)throw Error('stopped');return now;}
 stop(){this.tx(s=>{s.stopped=true;});}
 async process(serialized){
 let f,r,key,signature,owned=false;
 try{f=parseStrictJSON(serialized);const initialNow=this.tx(s=>this.clock(s));r=admit(f,this.c,initialNow);key=String(r.questionId);signature=sha256(f.raw);
 if(!Array.isArray(f.evidence)||f.evidence.length>3||new Set(f.evidence.map(e=>e.id)).size!==f.evidence.length||f.evidence.some(e=>!/^SYNTHETIC-SOURCE-[A-Za-z0-9-]{1,32}$/.test(e.id)||typeof e.probability!=='number'||!Number.isFinite(e.probability)||e.probability<0||e.probability>1))throw Error('evidence');
 this.tx(s=>{const at=this.clock(s),day=new Date(at).toISOString().slice(0,10),d=s.days[day]??={questions:0,attempts:0};if(s.items[key])throw Error(s.items[key].signature===signature?'duplicate':'changed');if(Object.values(s.items).some(i=>['ADMITTED','MODEL_RESERVED','SUBMIT_RESERVED','UNKNOWN','ACKNOWLEDGED'].includes(i.state)))throw Error('unfinished-pair');if(s.questions>=20||d.questions>=5||s.sources+f.evidence.length>60)throw Error('budget');s.questions++;d.questions++;s.sources+=f.evidence.length;s.items[key]={state:'ADMITTED',signature,postId:r.postId};});owned=true;
 if(!f.evidence.length||new Set(f.evidence.map(e=>e.probability)).size!==1){this.tx(s=>{s.items[key].state='ABSTAIN';});return out('ABSTAIN','missing-or-conflicting-synthetic-evidence');}
 this.tx(s=>{const at=this.clock(s),day=new Date(at).toISOString().slice(0,10),d=s.days[day]??={questions:0,attempts:0};if(s.attempts>=24||d.attempts>=5)throw Error('budget');s.attempts++;d.attempts++;s.items[key].state='MODEL_RESERVED';});
 // Reservation commits synchronously. Final clock check has no await before mock model invocation.
 const request=compatibleRequest({question_id:'SYNTHETIC-NOT-REAL-'+key,source_ids:f.evidence.map(e=>e.id)});request.input.max_tokens=512;request.input.messages[1].content=JSON.stringify({question_id:'SYNTHETIC-NOT-REAL-'+key,fixture:'Fictional event only',evidence:f.evidence});
 this.tx(s=>admit(f,this.c,this.clock(s)));const answer=await bounded(this.d.model({synthetic:true,liveUseAllowed:false,request}));
 const normalized=normalizeBinding(answer);const checked=normalized.ok&&validateForecast(normalized.result,{question_id:'SYNTHETIC-NOT-REAL-'+key,source_ids:f.evidence.map(e=>e.id)},{providerResolved:true,httpStatus:200});
 if(!checked||!checked.ok)throw Error('model-invalid');if(checked.value.status==='abstain'){this.tx(s=>{s.items[key].state='ABSTAIN';});return out('ABSTAIN','model');}
 // Fixture oracle only, not a real evidence adequacy or probability correctness proof.
 if(checked.value.probability!==f.evidence[0].probability)throw Error('synthetic-oracle');
 const current=parseStrictJSON(await bounded(this.d.refresh()));const now=this.tx(s=>this.clock(s));admit(current,this.c,now);if(sha256(current.raw)!==signature||sha256(current.evidence)!==sha256(f.evidence))throw Error('changed');
 const descriptor=makeDescriptor({synthetic:true,configHash:this.hash,roundId:r.roundProjectId,expectedRoundId:f.gate.protocol.roundProjectId,authorId:f.gate.protocol.accountId,questionId:r.questionId,postId:r.postId,postQuestionId:r.postQuestionId,questionType:'binary',postKind:'single',verifiedAt:now,validUntil:Math.min(now+60000,Date.parse(r.closesAt)),roundEnd:Date.parse(f.gate.protocol.roundClosesAt),protocolDeadline:this.c.end,eligibilityVerified:true,participationVerified:true,primaryBotVerified:true,questionPostVerified:true,previousPairConfirmed:true,noPriorForecast:true},{status:'forecast',probability:checked.value.probability,reasoning:checked.value.rationale},now);
 this.tx(s=>{this.clock(s);s.items[key].state='SUBMIT_RESERVED';s.items[key].descriptor=descriptor;});this.tx(s=>{const at=this.clock(s);admit(current,this.c,at);if(at>=descriptor.context.validUntil)throw Error('descriptor-expired');});
 let receipt;try{receipt=await bounded(this.d.submit(descriptor));}catch{this.tx(s=>{s.items[key].state='UNKNOWN';s.stopped=true;});return out('UNKNOWN','transport-uncertain-no-retry');}
 let ack=acknowledge(descriptor,receipt);this.tx(s=>{const receivedNow=this.clock(s);if(ack.state==='acknowledged'&&receipt.receivedAt>receivedNow)ack={state:'unknown',reason:'future-ack'};s.items[key].state=ack.state==='acknowledged'?'ACKNOWLEDGED':'UNKNOWN';if(ack.state!=='acknowledged')s.stopped=true;});return out(ack.state==='acknowledged'?'ACKNOWLEDGED':'UNKNOWN',ack.reason);
 }catch(e){try{if(key&&owned)this.tx(s=>{const i=s.items[key];if(i&&['MODEL_RESERVED','SUBMIT_RESERVED','ADMITTED'].includes(i.state)){i.state=i.state==='SUBMIT_RESERVED'?'UNKNOWN':'BLOCKED';s.stopped=true;}});}catch{}let uncertain=false;try{uncertain=key&&this.status().items[key]?.state==='UNKNOWN';}catch{}return out(uncertain?'UNKNOWN':'BLOCKED',e.message==='duplicate'?'duplicate':e.message==='changed'?'changed':'fail-closed');}
 }
 reconcile(questionId,evidence){return this.tx(s=>{const i=s.items[String(questionId)];if(!i?.descriptor)return out('UNKNOWN','no-descriptor');if(!['ACKNOWLEDGED','UNKNOWN','CONFIRMED'].includes(i.state))return out('UNKNOWN','submission-not-settled');const v=reconcile(i.descriptor,evidence,this.d.now());if(v.state==='confirmed')i.state='CONFIRMED';return {...v,synthetic:true,liveUseAllowed:false};});}
}
