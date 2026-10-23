import {Rehearsal} from '../core.mjs';
import {CONFIG,OBJECT_NAME} from './config.mjs';
const enabled=c=>c.routesEnabled===true&&c.window?.enabled===true&&Number.isSafeInteger(c.window.start)&&c.window.start>0&&c.window.expires===c.window.start+1200000;
async function emptyBody(request){if(request.body===null)return true;const reader=request.body.getReader();let timer;const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({timeout:true}),1000);});try{for(let n=0;n<2;n++){const chunk=await Promise.race([reader.read(),timeout]);if(chunk.timeout)return false;if(chunk.done)return true;if(!(chunk.value instanceof Uint8Array)||chunk.value.byteLength!==0)return false;}return false;}finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}}
export function handler(config=CONFIG){return {async fetch(request,env){const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});try{if(!enabled(config))return reply({state:'disabled'},503);const u=new URL(request.url);if(u.search||u.hash)return reply({state:'rejected'},400);if(request.method==='GET'&&u.pathname==='/status')return reply(await env.REHEARSAL.getByName(OBJECT_NAME).status());if(request.method!=='POST'||u.pathname!=='/start')return reply({state:'not-found'},404);if(request.headers.has('content-type')||(request.headers.has('content-length')&&request.headers.get('content-length')!=='0')||!await emptyBody(request))return reply({state:'rejected'},400);return reply(await env.REHEARSAL.getByName(OBJECT_NAME).start());}catch{return reply({state:'unavailable'},503);}}};}
// Inject the official base class for deployment, a fake base for offline tests.
// Private fields prevent accidental RPC exposure of the runner/storage/AI objects.
export function objectClass(Base,config=CONFIG,now=Date.now){return class extends Base {
 #runner; #env; #active;
 constructor(ctx,env){super(ctx,env);this.#env=env;this.#active=enabled(config);ctx.blockConcurrencyWhile(async()=>{this.#runner=new Rehearsal(ctx.storage,this.#active?config.window:undefined,now);await this.#runner.ready;});}
 async start(){if(!this.#active)return {state:'disabled',alarmPresent:false};return this.#runner.start(this.#env.AI);}
 async status(){return this.#runner.status();}
 async alarm(){if(!this.#active)return;try{await this.#runner.alarm(this.#env.AI);}catch{await this.#runner.storageFailure();}}
};}
