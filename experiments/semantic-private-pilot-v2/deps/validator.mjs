// Pure OFFLINE validator/request fixture. No provider, storage or publication code.
export const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const VERSION='semantic-forecast-v2';
export const MAX_OUTPUT=2000;
const reject=reason=>({ok:false,reason});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
function keys(x,required,optional=[]) {
  return object(x)&&Reflect.ownKeys(x).every(k=>typeof k==='string'&&[...required,...optional].includes(k)&&Object.getOwnPropertyDescriptor(x,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'))&&required.every(k=>Object.hasOwn(x,k));
}
// Never invoke caller-provided iterators or getters. Copy bounded dense data once.
function arrayCopy(value,maxLength) {
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
  const length=Object.getOwnPropertyDescriptor(value,'length')?.value;
  if(!Number.isSafeInteger(length)||length<0||length>maxLength)return null;
  const names=Reflect.ownKeys(value);
  if(names.length!==length+1||names.some(k=>k!=='length'&&(typeof k!=='string'||! /^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=length)))return null;
  const copy=[];
  for(let i=0;i<length;i++) {const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return null;copy.push(d.value);}
  return copy;
}
function context(c) {
  if(!keys(c,['question_id','source_ids'])||typeof c.question_id!=='string'||!/^Q-[A-Za-z0-9-]{1,64}$/.test(c.question_id))return null;
  const ids=arrayCopy(c.source_ids,3);
  if(!ids||new Set(ids).size!==ids.length||!ids.every(x=>typeof x==='string'&&/^S-[A-Za-z0-9-]{1,32}$/.test(x)))return null;
  return {question_id:c.question_id,source_ids:ids};
}
export function schemaFor(c) {
  c=context(c);if(!c)throw Error('invalid-context');
  return {type:'object',additionalProperties:false,required:['schema_version','question_id','status','probability','source_ids','rationale','criterion_summary','uncertainty'],properties:{schema_version:{type:'string',enum:[VERSION]},question_id:{type:'string',enum:[c.question_id]},status:{type:'string',enum:['forecast','abstain']},probability:{type:['number','null'],minimum:0,maximum:1},source_ids:{type:'array',maxItems:3,uniqueItems:true,items:{type:'string',enum:[...c.source_ids]}},rationale:{type:'string',minLength:1,maxLength:600},criterion_summary:{type:'string',minLength:1,maxLength:300},uncertainty:{type:'string',minLength:1,maxLength:250}},anyOf:[{properties:{status:{enum:['forecast']},probability:{type:'number'},source_ids:{minItems:1}}},{properties:{status:{enum:['abstain']},probability:{type:'null'}}}]};
}
export function requestFixture(c) {
  c=context(c);if(!c)throw Error('invalid-context');
  return {model:MODEL,input:{messages:[{role:'system',content:'Return only the supplied JSON schema. This is a fictional offline fixture. Abstain if evidence is inadequate; never invent source IDs.'},{role:'user',content:JSON.stringify({question_id:c.question_id,source_ids:c.source_ids,fixture:'Synthetic binary event, no real question or evidence.'})}],response_format:{type:'json_schema',json_schema:schemaFor(c)},stream:false,max_tokens:MAX_OUTPUT,temperature:0}};
}
export function validateForecast(result,c,transport) {
  try {
    c=context(c);if(!c)return reject('context');
    if(!keys(transport,['providerResolved','httpStatus'])||transport.providerResolved!==true||transport.httpStatus!==200)return reject('provider');
    if(!keys(result,['response','usage'],['finish_reason','tool_calls']))return reject('envelope');
    if(Object.hasOwn(result,'finish_reason')&&result.finish_reason!=='stop')return reject('finish');
    if(Object.hasOwn(result,'tool_calls')&&arrayCopy(result.tool_calls,0)===null)return reject('tools');
    const u=result.usage;
    if(!keys(u,['prompt_tokens','completion_tokens','total_tokens'])||![u.prompt_tokens,u.completion_tokens,u.total_tokens].every(v=>Number.isSafeInteger(v)&&v>=0)||u.prompt_tokens>24000||u.completion_tokens>=MAX_OUTPUT||u.completion_tokens===0||u.total_tokens!==u.prompt_tokens+u.completion_tokens)return reject('usage');
    const r=result.response;
    if(!keys(r,['schema_version','question_id','status','probability','source_ids','rationale','criterion_summary','uncertainty']))return reject('response-object');
    if(r.schema_version!==VERSION||r.question_id!==c.question_id)return reject('identity');
    if(!['forecast','abstain'].includes(r.status))return reject('status');
    if(r.status==='forecast'?(typeof r.probability!=='number'||!Number.isFinite(r.probability)||r.probability<0||r.probability>1):r.probability!==null)return reject('probability');
    const ids=arrayCopy(r.source_ids,3);
    if(!ids||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!c.source_ids.includes(id))||(r.status==='forecast'&&ids.length===0))return reject('sources');
    if(typeof r.rationale!=='string'||r.rationale.trim().length===0||r.rationale.length>600||new TextEncoder().encode(r.rationale).length>4000)return reject('rationale');
    if(typeof r.criterion_summary!=='string'||!r.criterion_summary.trim()||r.criterion_summary.length>300||typeof r.uncertainty!=='string'||!r.uncertainty.trim()||r.uncertainty.length>250)return reject('semantic-fields');
    return {ok:true,value:{schema_version:r.schema_version,question_id:r.question_id,status:r.status,probability:r.probability,source_ids:ids,rationale:r.rationale,criterion_summary:r.criterion_summary,uncertainty:r.uncertainty},usage:{prompt_tokens:u.prompt_tokens,completion_tokens:u.completion_tokens,total_tokens:u.total_tokens}};
  }catch{return reject('unreadable');}
}
