// Pure OFFLINE contract. No HTTP, credentials, storage, retries or publication.
import {createHash} from 'node:crypto';
const ENDPOINT='/api/questions/bulk-forecast-comment/';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const int=n=>Number.isSafeInteger(n)&&n>0;
function record(x,names){if(!x||typeof x!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(x))||Reflect.ownKeys(x).length!==names.length)throw Error('shape');const r={};for(const k of names){const d=Object.getOwnPropertyDescriptor(x,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))throw Error('shape');r[k]=d.value;}return r;}
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
const flags=['eligibilityVerified','participationVerified','primaryBotVerified','questionPostVerified','previousPairConfirmed','noPriorForecast'];
const fields=['synthetic','configHash','roundId','expectedRoundId','authorId','questionId','postId','postQuestionId','questionType','postKind','verifiedAt','validUntil','roundEnd','protocolDeadline',...flags];
function context(input,now){const c=record(input,fields);if(c.synthetic!==true||typeof c.configHash!=='string'||! /^[a-f0-9]{64}$/.test(c.configHash)||!['roundId','expectedRoundId','authorId','questionId','postId','postQuestionId'].every(k=>int(c[k]))||c.roundId!==c.expectedRoundId||c.questionId!==c.postQuestionId||c.questionType!=='binary'||c.postKind!=='single'||flags.some(k=>c[k]!==true))throw Error('context');if(!int(now)||!['verifiedAt','validUntil','roundEnd','protocolDeadline'].every(k=>int(c[k]))||c.verifiedAt>now||now>=Math.min(c.validUntil,c.roundEnd,c.protocolDeadline))throw Error('time');return c;}
export function makeDescriptor(input,forecast,now){
 const c=context(input,now),f=record(forecast,['status','probability','reasoning']);
 if(f.status!=='forecast'||typeof f.probability!=='number'||!Number.isFinite(f.probability)||f.probability<.001||f.probability>.999)throw Error('probability');
 if(typeof f.reasoning!=='string'||!f.reasoning.trim()||Buffer.byteLength(f.reasoning,'utf8')>4000)throw Error('reasoning');
 const body={forecasts:[{question:c.questionId,probability_yes:f.probability}],comments:[{on_post:c.postId,text:f.reasoning,is_private:true,included_forecast:true}]};
 const base={kind:'synthetic-atomic-contract-v1',method:'POST',path:ENDPOINT,context:c,createdAt:now,bodyJson:JSON.stringify(body)};
 return freeze({...base,digest:hash(JSON.stringify(base)),body});
}
function verified(d){const x=record(d,['kind','method','path','context','createdAt','bodyJson','digest','body']);const c=record(x.context,fields);const b=record(x.body,['forecasts','comments']);function one(a){if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||Reflect.ownKeys(a).length!==2||Object.getOwnPropertyDescriptor(a,'length')?.value!==1)throw Error('array');const q=Object.getOwnPropertyDescriptor(a,'0');if(!q?.enumerable||!Object.hasOwn(q,'value'))throw Error('array');return q.value;}
 const f=record(one(b.forecasts),['question','probability_yes']),m=record(one(b.comments),['on_post','text','is_private','included_forecast']);
 const rebuilt=makeDescriptor(c,{status:'forecast',probability:f.probability_yes,reasoning:m.text},x.createdAt);
 if(x.kind!==rebuilt.kind||x.method!==rebuilt.method||x.path!==rebuilt.path||x.bodyJson!==rebuilt.bodyJson||x.digest!==rebuilt.digest||f.question!==c.questionId||m.on_post!==c.postId||m.is_private!==true||m.included_forecast!==true)throw Error('descriptor');return rebuilt;
}
const outcome=(state,reason)=>Object.freeze({state,reason,retryAllowed:false});
// Normalized trusted-transport evidence, NOT a claim that the API returns these fields.
export function acknowledge(descriptor,evidence){try{const d=verified(descriptor),e=record(evidence,['requestDigest','authorId','httpStatus','body','receivedAt','requestCorrelationVerified']);record(e.body,[]);if(e.requestDigest!==d.digest||e.authorId!==d.context.authorId||e.requestCorrelationVerified!==true||e.httpStatus!==201||!int(e.receivedAt)||e.receivedAt<d.createdAt)return outcome('unknown','ack-mismatch');return outcome('acknowledged','atomic-201-no-identifiers');}catch{return outcome('unknown','ack-unverified');}}
// Correlation is deliberately stronger than matching values/times. The documented
// API does not supply this proof today. Caller assertions are NOT authentication.
export function reconcile(descriptor,evidence,now){try{
 const d=verified(descriptor),e=record(evidence,['observedAt','complete','forecast','comment','correlation']);
 if(!int(now)||!int(e.observedAt)||e.observedAt<d.createdAt||e.observedAt>now||now-e.observedAt>60000||e.complete!==true)return outcome('unknown','stale-or-partial');
 const f=record(e.forecast,['id','authorId','questionId','probability','createdAt']);
 const m=record(e.comment,['id','authorId','postId','text','isPrivate','includedForecastId','createdAt']);
 const k=record(e.correlation,['kind','requestDigest','authorId','forecastId','commentId','verifiedAt']);
 if(!int(f.id)||!int(m.id)||f.authorId!==d.context.authorId||m.authorId!==d.context.authorId||f.questionId!==d.context.questionId||m.postId!==d.context.postId||f.probability!==d.body.forecasts[0].probability_yes||m.text!==d.body.comments[0].text||m.isPrivate!==true||m.includedForecastId!==f.id||![f.createdAt,m.createdAt].every(t=>int(t)&&t>=d.createdAt&&t<=e.observedAt))return outcome('unknown','pair-mismatch');
 if(k.kind!=='authoritative-request-pair-link'||k.requestDigest!==d.digest||k.authorId!==d.context.authorId||k.forecastId!==f.id||k.commentId!==m.id||!int(k.verifiedAt)||k.verifiedAt<d.createdAt||k.verifiedAt>e.observedAt)return outcome('unknown','correlation-unverified');
 return outcome('confirmed','authoritative-pair-link');
 }catch{return outcome('unknown','evidence-unverified');}}
