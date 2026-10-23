import {run} from './runner.mjs';
function assert(x,label){if(!x)throw Error(label);}
export default {async test(){
 const init={method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Authorization:'Token SYNTHETIC',Accept:'application/json'},signal:new AbortController().signal};
 let constructorError=null;try{new Request('https://fixture.invalid/',init);}catch(e){constructorError=e.name;}assert(constructorError==='TypeError','historical constructor must reject');
 let returned=false,rejection=null;try{const pending=globalThis.fetch('https://fixture.invalid/',init);returned=true;await pending;}catch(e){rejection=e.name;}assert(returned&&rejection==='TypeError','historical fetch must reject returned promise');
 const manual={...init,redirect:'manual'};delete manual.credentials;
 const request=new Request('https://fixture.invalid/',manual);assert(request.redirect==='manual','manual Request accepted');
 const response=await globalThis.fetch(request);assert(response.status===200,'manual fetch reaches only in-process fixture');
 const redirect=await globalThis.fetch('https://fixture.invalid/redirect',manual);assert(redirect.status===302,'manual exposes redirect without following');
 // Current runtime ignores this browser-only option. Candidate nevertheless omits it.
 const omitted=new Request('https://fixture.invalid/',{...manual,credentials:'omit'});assert(omitted.method==='GET','credentials ignored in pinned runtime');
 let state='ready',record,calls=0;
 const start=Date.now();const result=await run({now:()=>Date.now(),setTimeout,clearTimeout,getToken:()=> 'SYNTHETIC',claimOnce:async()=>{if(state!=='ready')return false;state='reserved';return true;},persist:async value=>{if(state!=='reserved')throw Error('terminal');state=value.state;record=structuredClone(value);},request:(url,options)=>{calls++;return globalThis.fetch(url,options);}},{enabled:true,start,expires:start+300000});
 assert(result.state==='verified'&&record.httpStatus===200&&record.fetchResolved===true&&calls===1,'candidate runner uses actual workerd transport');
 console.log('PASS: historical Request TypeError; historical fetch promise rejection; manual construction/local fetch;302 nofollow; credentials ignored; candidate runner verified against local fixture only.');
}};
