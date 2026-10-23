// Retain only locally defined stages, booleans, safe clocks and numeric metadata.
// Never inspect binding-global status, error text/stacks, or provider/user text.
// Numeric codes are observed own error properties, NOT authoritative HTTP status.
// Persisted dispatch-ready/false is intent only: a crash after invocation but
// before its diagnostic flush is ambiguous. Recovery remains UNKNOWN/no retry.
function own(value,key){try{if(value===null||!['object','function'].includes(typeof value))return undefined;const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}}
export function safeNumericCodes(error){const out={};for(const key of ['code','status','statusCode']){const n=own(error,key);if(Number.isSafeInteger(n)&&n>=0&&(key==='code'||(n>=100&&n<=599)))out[key]=n;}return out;}
export function safeUsage(response){const u=own(response,'usage'),p=own(u,'prompt_tokens'),c=own(u,'completion_tokens'),t=own(u,'total_tokens');if(![p,c,t].every(n=>Number.isSafeInteger(n)&&n>=0)||p>24000||c>512||p+c!==t)return undefined;return {prompt_tokens:p,completion_tokens:c,total_tokens:t};}
function clock(now){try{const n=now();return Number.isSafeInteger(n)&&n>=0?n:null;}catch{return null;}}
export function reservedDiagnostics(now){return {stage:'reserved',dispatchAttempted:false,providerResolved:false,timestamps:{reserved:clock(now)}};}
export async function runDiagnosticModel({model,request,now,beforeDispatch,persist,validate,timeoutMs=15000,initial}){
 const diagnostic=structuredClone(initial??reservedDiagnostics(now));let usage,checkedResult,acceptOutcome=true;
 const mark=stage=>{diagnostic.stage=stage;diagnostic.timestamps[stage]=clock(now);};
 const failure=(stage,error)=>{mark(stage);const codes=safeNumericCodes(error);if(Object.keys(codes).length)diagnostic.numericCodes=codes;const e=Error(stage);e.safeModelFailure=stage;return e;};
 const store=async()=>{try{await persist(structuredClone(diagnostic),usage,checkedResult);}catch{throw failure('storage-failed');}};
 const fail=async(stage,error)=>{const e=failure(stage,error);await store();throw e;};
 try{
  mark('dispatch-ready');await store();
  // This is the final clock/budget check. No await occurs before invocation.
  mark('invoking');
  try{beforeDispatch();}catch{return await fail('dispatch-blocked');}
  diagnostic.dispatchAttempted=true;let pending;
  try{pending=model(request.model,request.input);}catch(error){return await fail('invocation-threw',error);}
  // Attach both handlers immediately, even if persisting dispatch takes time.
  const settled=Promise.resolve(pending).then(value=>{if(acceptOutcome){diagnostic.providerResolved=true;mark('provider-resolved');usage=safeUsage(value);}return {kind:'resolved',value};},error=>({kind:'rejected',error}));
  mark('awaiting-provider');let timer;
  // Start watchdog at invocation, not after the dispatch diagnostic flush.
  const watched=Promise.race([settled,new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'timeout'}),timeoutMs);})]);
  let outcome;try{await store();outcome=await watched;}finally{clearTimeout(timer);}
  if(outcome.kind==='timeout'){acceptOutcome=false;return await fail('watchdog-timeout');}
  if(outcome.kind==='rejected')return await fail('promise-rejected',outcome.error);
  diagnostic.providerResolved=true;mark('provider-resolved');usage=safeUsage(outcome.value);await store();
  let checked;try{checked=validate(outcome.value,request.context);}catch{return await fail('response-validation-failed');}
  if(!checked?.ok)return await fail('response-validation-failed');
  checkedResult=checked;mark('validated');await store();return checked;
 }catch(error){
  acceptOutcome=false;
  if(error?.safeModelFailure==='storage-failed'){
   // Best effort only: a failed storage service cannot promise durable retention.
   try{await persist(structuredClone(diagnostic),usage,checkedResult);}catch{}
  }
  throw error;
 }
}
