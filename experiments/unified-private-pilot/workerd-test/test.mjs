import {DurableObject,WorkerEntrypoint} from 'cloudflare:workers';
import {objectClass,handler} from './wiring.mjs';
import {requestFor,checkModel} from './model.mjs';
import {fixture,NOW,fakeModel} from './fixtures.mjs';
const config=fixture().config;
export class TestPilot extends objectClass(DurableObject,config,{now:()=>NOW}) {constructor(ctx,env){super(ctx,{...env,AI:{run:fakeModel}});}}
export class FakeAI extends WorkerEntrypoint {async run(model,input){return fakeModel(model,input);}}
export default {async test(_controller,env){
 const stub=env.PILOT.getByName('disabled-unified-pilot-v1');
 const result=await stub.tick();if(result.state!=='ACKNOWLEDGED')throw Error('vertical-slice:'+JSON.stringify(result));
 const status=await stub.status();if(status.attempts!==1||status.sources!==1||status.items[0].state!=='ACKNOWLEDGED')throw Error('SQL-ledger');
 const duplicate=await stub.tick();if(duplicate.state!=='ABSTAIN')throw Error('duplicate');
 if((await handler().fetch()).status!==503)throw Error('disabled-fetch');
 console.log('PASS actual workerd SQLite DO, fixed fake-service transport, fake AI, atomic201, duplicate prevention, disabled route');
}};
