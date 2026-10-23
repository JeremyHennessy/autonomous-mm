import {DurableObject,WorkerEntrypoint} from 'cloudflare:workers';
import {objectClass,handler} from './wiring.mjs';
import {requestFor,checkModel} from './model.mjs';
import {fixture,NOW,fakeModel} from './fixtures.mjs';
const config=fixture().config;
async function checkedFakeModel(model,input){const payload=JSON.parse(input.messages[1].content),observation=payload.evidence[0].observation;
 if(!observation.text.includes('Fictional station report')||observation.text.includes('OMIT_')||observation.representation!=='bounded-excerpt'||observation.fullSource!==false||observation.freshnessProven!==false)throw Error('bounded-html-excerpt');
 return fakeModel(model,input);
}
export class TestPilot extends objectClass(DurableObject,config,{now:()=>NOW}) {constructor(ctx,env){super(ctx,{...env,AI:{run:checkedFakeModel}});}}
export class FakeAI extends WorkerEntrypoint {async run(model,input){return checkedFakeModel(model,input);}}
export default {async test(_controller,env){
 const stub=env.PILOT.getByName('disabled-semantic-pilot-v2');
 const result=await stub.tick();if(result.state!=='ACKNOWLEDGED')throw Error('vertical-slice:'+JSON.stringify(result));
 const status=await stub.status();if(status.attempts!==1||status.sources!==1||status.items[0].state!=='ACKNOWLEDGED')throw Error('SQL-ledger');
 const duplicate=await stub.tick();if(duplicate.state!=='WAITING')throw Error('duplicate');
 if((await handler().fetch()).status!==503)throw Error('disabled-fetch');
 console.log('PASS actual workerd SQLite DO, fixed fake-service transport, fake AI, atomic201, duplicate prevention, disabled route');
}};
