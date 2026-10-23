import {DESCRIPTION,FINE_PRINT} from './admission.mjs';
export const NOW=Date.parse('2026-10-23T12:00:00.000Z');
export function fixture(){
 const config={enabled:true,start:NOW-1000,end:NOW+3600000,roundEnd:NOW+2*86400000,roundId:17,roundSlug:'frozen-round-17',accountId:42,roundOpensAt:'2026-10-22T00:00:00.000Z',roundClosesAt:'2026-10-25T00:00:00.000Z',maxAgeMs:60000,historyComplete:true,participationVerified:true,primaryBotVerified:true,sourceAllowlist:[{host:'example.com',pathPrefix:'/data/'}]};
 const post={id:100,curation_status:'approved',status:'open',projects:{tournament:[{id:17,slug:'frozen-round-17',type:'tournament'}]},question:{id:201,post_id:100,type:'binary',status:'open',open_time:'2026-10-22T00:00:00.000Z',scheduled_close_time:'2026-10-24T00:00:00.000Z',actual_close_time:'2026-10-24T00:00:00.000Z',scheduled_resolve_time:'2026-10-24T01:00:00.000Z',actual_resolve_time:null,resolution_set_time:null,my_forecasts:{history:[],latest:null},description:DESCRIPTION,fine_print:FINE_PRINT,resolution_criteria:'Resolves Yes if metric "temperature" in unit "celsius" is >= 20 at 2026-10-24T00:00:00.000Z, otherwise No. Source: https://example.com/data/observations.json'}};
 const history={results:[{question_id:201,forecasts:[]}]};
 const evidence={source_url:'https://example.com/data/observations.json',metric:'temperature',unit:'celsius',value:19,observed_at:new Date(NOW).toISOString()};
 return {config,post,history,evidence};
}
export function fakeService(f=fixture()){
 const requests=[];const fetch=async(url,init)=>{requests.push({url,method:init.method,headers:init.headers,body:init.body});if(url.startsWith('https://example.com/'))return Response.json(f.evidence);if(init.method==='POST')return Response.json({},{status:201});if(url.includes('/bulk-forecast-read/'))return Response.json(f.history);if(url.includes('/posts/100/'))return Response.json(f.post);if(url.includes('/posts/?'))return Response.json({next:null,previous:null,results:[f.post]});throw Error('unexpected-local-fixture-route');};return {fetch,requests};
}
export async function fakeModel(_model,input){const c=JSON.parse(input.messages[1].content);return {response:{schema_version:'forecast-v1',question_id:c.question.questionId?'Q-'+c.question.questionId:'bad',status:'forecast',probability:0.5,source_ids:c.source_ids,rationale:'Fictional test estimate, not a real forecast.'},usage:{prompt_tokens:300,completion_tokens:80,total_tokens:380},finish_reason:'stop',tool_calls:[]};}
