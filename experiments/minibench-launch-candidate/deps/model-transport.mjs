// Pure narrow adapters. REST envelope is never silently treated as an AI binding result.
import {MODEL} from './validator.mjs';
const fail=()=>{throw Error('transport');};
// Snapshot bounded JSON data without invoking accessors, iterators or toJSON.
function snapshot(x,depth=0,budget={n:0}){
 if(++budget.n>256||depth>8)fail();
 if(x===null||typeof x==='boolean')return x;
 if(typeof x==='number'){if(!Number.isFinite(x))fail();return x;}
 if(typeof x==='string'){if(x.length>8192)fail();return x;}
 if(typeof x!=='object')fail();
 const arr=Array.isArray(x),proto=Object.getPrototypeOf(x);
 if(arr?proto!==Array.prototype:![Object.prototype,null].includes(proto))fail();
 const out=arr?[]:Object.create(null),names=Reflect.ownKeys(x);
 if(arr){const n=Object.getOwnPropertyDescriptor(x,'length')?.value;if(!Number.isSafeInteger(n)||n>32||names.length!==n+1)fail();for(let i=0;i<n;i++)if(!Object.hasOwn(x,String(i)))fail();}
 for(const k of names){if(arr&&k==='length')continue;if(typeof k!=='string'||(arr&&!/^(0|[1-9][0-9]*)$/.test(k)))fail();const d=Object.getOwnPropertyDescriptor(x,k);if(!d.enumerable||!Object.hasOwn(d,'value'))fail();Object.defineProperty(out,k,{value:snapshot(d.value,depth+1,budget),enumerable:true,writable:true,configurable:true});}
 return out;
}
function keys(o,required,optional=[]){if(o===null||typeof o!=='object'||Array.isArray(o)||!required.every(k=>Object.hasOwn(o,k))||Object.keys(o).some(k=>![...required,...optional].includes(k)))fail();}
function empty(a){if(!Array.isArray(a)||a.length!==0)fail();}
function nullFields(o,names){for(const k of names)if(Object.hasOwn(o,k)&&o[k]!==null)fail();}
const integer=n=>Number.isSafeInteger(n)&&n>=0;
function usage(u){keys(u,['prompt_tokens','completion_tokens','total_tokens'],['prompt_tokens_details','neurons']);const {prompt_tokens:p,completion_tokens:c,total_tokens:t}=u;if(![p,c,t].every(integer)||p>24000||c===0||c>=512||p+c!==t)fail();if(Object.hasOwn(u,'neurons')&&!(typeof u.neurons==='number'&&u.neurons>=0))fail();if(Object.hasOwn(u,'prompt_tokens_details')){keys(u.prompt_tokens_details,['cached_tokens']);if(!integer(u.prompt_tokens_details.cached_tokens)||u.prompt_tokens_details.cached_tokens>p)fail();}return {prompt_tokens:p,completion_tokens:c,total_tokens:t};}
// Only erase JSON whitespace outside strings. Exact compact serialization agreement
// deliberately rejects reordered keys, alternate number encodings and duplicate keys.
function compact(s){let out='',quoted=false,escaped=false;for(const ch of s){if(quoted){out+=ch;if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}else if(ch==='"'){quoted=true;out+=ch;}else if(![' ','\n','\r','\t'].includes(ch))out+=ch;}return out;}
function binding(r){
 const metadata=['id','object','created','model','service_tier','prompt_logprobs','prompt_token_ids','prompt_text','kv_transfer_params','ec_transfer_params','metrics'];
 keys(r,['response','usage'],['choices','finish_reason','tool_calls',...metadata]);
 if(!r.response||typeof r.response!=='object'||Array.isArray(r.response))fail();
 if(Object.hasOwn(r,'tool_calls'))empty(r.tool_calls);
 nullFields(r,['service_tier','prompt_logprobs','prompt_token_ids','prompt_text','kv_transfer_params','ec_transfer_params','metrics']);
 if(Object.hasOwn(r,'id')&&(typeof r.id!=='string'||!/^chatcmpl-[A-Za-z0-9-]{1,100}$/.test(r.id)))fail();
 if(Object.hasOwn(r,'object')&&r.object!=='chat.completion')fail();
 if(Object.hasOwn(r,'created')&&!integer(r.created))fail();
 if(Object.hasOwn(r,'model')&&![MODEL,'@cf/meta/llama-3.3-70b-json'].includes(r.model))fail();
 if(Object.hasOwn(r,'finish_reason')&&r.finish_reason!=='stop')fail();
 if(Object.hasOwn(r,'choices')){
  if(!Array.isArray(r.choices)||r.choices.length!==1)fail();const c=r.choices[0];
  keys(c,['index','message','finish_reason'],['logprobs','stop_reason','token_ids','routed_experts']);
  if(c.index!==0||c.finish_reason!=='stop')fail();nullFields(c,['logprobs','stop_reason','token_ids','routed_experts']);
  const m=c.message;keys(m,['role','content'],['refusal','annotations','audio','function_call','reasoning','tool_calls']);
  if(m.role!=='assistant'||typeof m.content!=='string')fail();nullFields(m,['refusal','annotations','audio','function_call','reasoning']);if(Object.hasOwn(m,'tool_calls'))empty(m.tool_calls);
  if(compact(m.content)!==JSON.stringify(r.response))fail();
 }else if(r.finish_reason!=='stop'||metadata.some(k=>Object.hasOwn(r,k)))fail();
 return {response:r.response,usage:usage(r.usage),finish_reason:'stop',tool_calls:[]};
}
export function normalizeBinding(value){try{return {ok:true,result:binding(snapshot(value))};}catch{return {ok:false,reason:'transport'};}}
export function normalizeRest(value,transport){try{const t=snapshot(transport);keys(t,['providerResolved','httpStatus']);if(t.providerResolved!==true||t.httpStatus!==200)fail();const r=snapshot(value);keys(r,['result','success','errors','messages','status']);if(r.success!==true||r.status!==200)fail();empty(r.errors);empty(r.messages);return {ok:true,result:binding(r.result)};}catch{return {ok:false,reason:'rest-transport'};}}
