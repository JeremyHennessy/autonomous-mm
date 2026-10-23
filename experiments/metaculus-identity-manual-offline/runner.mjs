// Offline candidate. No default network, credential, timer or storage binding.
export const CONFIG=Object.freeze({enabled:false,start:0,expires:0});
export const TARGET='https://www.metaculus.com/api/users/me/';
const names=new Set(['AbortError','TimeoutError','TypeError','SyntaxError','RangeError']);
function errorClass(e){try{return names.has(e?.name)?e.name:'other';}catch{return 'unreadable';}}
export async function run(d,c=CONFIG){
 if(c.enabled!==true)return {state:'disabled'};
 if(!Number.isSafeInteger(c.start)||!Number.isSafeInteger(c.expires)||c.start<=0||c.expires<=c.start||c.expires-c.start>300000)return {state:'disabled'};
 const valid=t=>Number.isSafeInteger(t)&&t>=c.start&&t<c.expires;
 let previous,diag={state:'reserved',stage:'claim',dispatchAttempted:false,dispatchMayHaveOccurred:false,fetchResolved:false,httpStatus:null,contentType:'unobserved',errorClass:null,bytes:0,chunks:0,body:'unread',parse:'unread',shape:'unread',timestamps:{}};
 const stamp=()=>{const n=d.now();if(!valid(n)||(previous!==undefined&&n<previous))throw Error('clock');previous=n;return n;};
 const snapshot=()=>structuredClone(diag);
 try{stamp();if(await d.claimOnce()!==true)return {state:'consumed'};}catch{return {state:'storage-unverified'};}
 let controller=new AbortController(),timer,reader,closed=false;
 const save=async()=>d.persist(snapshot());
 const finish=async(state,category)=>{closed=true;diag.state=state;diag.category=category;try{diag.timestamps.finished=stamp();}catch{diag.state='uncertain';diag.category='clock';}try{await save();try{stamp();}catch{if(diag.state==='verified'){diag.state='uncertain';diag.category='clock';await save();}}return snapshot();}catch{return {state:'storage-unverified'};}};
 const step=async stage=>{if(closed)throw Error('closed');diag.stage=stage;diag.timestamps[stage]=stamp();await save();if(closed)throw Error('closed');};
 let token,options;
 try{
  await step('credential');token=d.getToken();if(typeof token!=='string'||!token.length||token.length>4096||/\s/.test(token))return await finish('stopped','credential');
  await step('request-construction');options={method:'GET',redirect:'manual',cache:'no-store',headers:{Authorization:'Token '+token,Accept:'application/json'},signal:controller.signal};token=null;
  // This durable marker covers crash ambiguity. It is NOT proof dispatch happened.
  diag.dispatchMayHaveOccurred=true;await step('dispatch-invocation');
  const at=stamp(); // Last authoritative check: no await before invocation.
  let pending;try{diag.dispatchAttempted=true;diag.timestamps.dispatch=at;pending=d.request(TARGET,options);}catch(e){diag.errorClass=errorClass(e);return await finish('uncertain','dispatch-throw');}finally{options=null;}
  const settled=Promise.resolve(pending).then(r=>({r}),e=>({e,failed:true}));
  const operation=(async()=>{
   diag.stage='fetch-await';await save();
   const outcome=await settled;if(closed)return;if(outcome.failed){diag.errorClass=errorClass(outcome.e);return {category:'fetch-rejected',state:'uncertain'};}const response=outcome.r;
   if(closed)return;diag.fetchResolved=true;await step('response-extraction');
   diag.stage='status-extraction';const status=response.status;if(!Number.isInteger(status)||status<100||status>599)return {state:'stopped',category:'invalid-status'};diag.httpStatus=status;
   diag.stage='redirect-extraction';if(response.redirected===true||status>=300&&status<400)return {state:'stopped',category:'redirect-response'};
   diag.stage='content-type-extraction';const ct=response.headers.get('content-type');diag.contentType=typeof ct==='string'&&/^application\/json(?:\s*;|$)/i.test(ct)?'json':typeof ct==='string'&&/^text\/html(?:\s*;|$)/i.test(ct)?'html':ct===null?'absent':'other';
   if(status!==200)return {state:'stopped',category:'http-rejected'};
   if(diag.contentType!=='json')return {state:'stopped',category:'content-type'};
   await step('body-read');reader=response.body.getReader();const chunks=[];
   for(;;){const {done,value}=await reader.read();if(closed)return;if(done)break;diag.chunks++;if(!(value instanceof Uint8Array))return {state:'stopped',category:'body-type'};diag.bytes+=value.byteLength;if(diag.bytes>16384||diag.chunks>32){diag.body='oversized';return {state:'stopped',category:'body-limit'};}chunks.push(value.slice());}
   diag.body='complete';await step('body-decode');const all=new Uint8Array(diag.bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}const text=new TextDecoder('utf-8',{fatal:true}).decode(all);
   await step('json-parse');let profile;try{profile=JSON.parse(text);}catch(e){diag.parse='invalid';diag.errorClass=errorClass(e);return {state:'stopped',category:'json-invalid'};}diag.parse='valid';
   await step('identity-shape');if(!profile||typeof profile!=='object'||Array.isArray(profile)||!Number.isSafeInteger(profile.id)||typeof profile.username!=='string'||typeof profile.is_bot!=='boolean'){diag.shape='invalid';return {state:'stopped',category:'identity-shape'};}
   diag.shape='valid';return profile.id===800001&&profile.username==='SyntheticIdentityBot'&&profile.is_bot===true?{state:'verified',category:'match'}:{state:'stopped',category:'identity-mismatch'};
  })().catch(e=>{diag.errorClass=errorClass(e);return {state:'uncertain',category:diag.stage+'-error'};});
  const verdict=await Promise.race([operation,new Promise(resolve=>{timer=d.setTimeout(()=>{closed=true;controller.abort();resolve({state:'uncertain',category:'watchdog'});},Math.min(5000,c.expires-at));})]);
  const completed=stamp();if(completed-at>=5000)return await finish('uncertain','watchdog');
  return await finish(verdict.state,verdict.category);
 }catch(e){diag.errorClass=errorClass(e);return await finish('uncertain',diag.stage+'-error');}
 finally{closed=true;token=null;options=null;d.clearTimeout(timer);controller.abort();try{void reader?.cancel().catch(()=>{});}catch{}}
}
