import {run} from '../runner.mjs';
import {ledger} from '../ledger.mjs';
import {CONFIG} from './config.mjs';
export const OBJECT_NAME='synthetic-identity-diagnostic-example';
export function handler(config=CONFIG){return Object.freeze({
 fetch(){return new Response('Disabled',{status:503,headers:{'cache-control':'no-store'}});},
 async scheduled(_event,env){
  if(config.enabled!==true)return;
  // Errors are never logged or rethrown into platform logs. No raw RPC result exposed.
  try{await env.IDENTITY_DIAGNOSTIC.getByName(OBJECT_NAME).run();}catch{}
 }
});}
export function objectClass(Base,config=CONFIG,services){return class extends Base{
 #ready;#store;#failed=false;#env;
 constructor(ctx,env){super(ctx,env);this.#env=env;
  this.#ready=ctx.blockConcurrencyWhile(async()=>{
   if(config.enabled!==true)return;
   try{this.#store=await ledger(ctx.storage,config);}catch{this.#failed=true;}
  });
 }
 async run(){
  try{
   await this.#ready;if(config.enabled!==true)return {state:'disabled'};
   if(this.#failed||!this.#store)return {state:'storage-unverified'};
   // Never return detailed diagnostics over RPC; private SQL is the sole readback.
   const value=await run({...this.#store,
    now:services.now,setTimeout:services.setTimeout,clearTimeout:services.clearTimeout,
    request:services.request,getToken:()=>this.#env.METACULUS_TOKEN
   },config);
   return {state:value.state};
  }catch{return {state:'storage-unverified'};}
 }
};}
