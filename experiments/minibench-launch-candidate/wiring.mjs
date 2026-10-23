import {Pilot} from './runner.mjs';
import {sqliteStore} from './ledger.mjs';
import {createTransport} from './transport.mjs';
import {CONFIG,OBJECT_NAME} from './config.mjs';
// No HTTP or RPC endpoint accepts caller prompts, IDs, URLs or secret values.
export function handler(config=CONFIG){return {fetch(){return new Response('Disabled',{status:503});},async scheduled(_event,env){if(!config.enabled)return;return env.PILOT.getByName(OBJECT_NAME).tick();}};}
export function objectClass(Base,config=CONFIG,dependencies={}){return class extends Base{
 #pilot; #ready;
 constructor(ctx,env){super(ctx,env);this.#ready=ctx.blockConcurrencyWhile(async()=>{
  if(!config.enabled){this.#pilot=new Pilot(null,config,{});return;}
  const now=dependencies.now??Date.now;
  const transport=createTransport({fetch:dependencies.fetch??((...args)=>globalThis.fetch(...args)),getToken:()=>env.METACULUS_TOKEN,tournamentSlug:config.roundSlug,sourceAllowlist:config.sourceAllowlist,now});
  this.#pilot=new Pilot(sqliteStore(ctx.storage),config,{now,transport,model:(model,input)=>env.AI.run(model,input)});await this.#pilot.ready;
 });}
 async tick(){await this.#ready;return this.#pilot.tick();}
 async status(){await this.#ready;return this.#pilot.status();}
};}
