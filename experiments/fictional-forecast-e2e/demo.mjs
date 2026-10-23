import {DatabaseSync} from 'node:sqlite';
import {Pipeline} from './pipeline.mjs';
import {fixture,CONFIG,START,modelResult} from './fixtures.mjs';
const f=fixture(),db=new DatabaseSync(':memory:');let exactPair;
const pipeline=new Pipeline(db,CONFIG,{now:()=>START+3600000,model:async()=>modelResult(),refresh:async()=>JSON.stringify(f),submit:async descriptor=>{exactPair=descriptor.body;return {requestDigest:descriptor.digest,authorId:888,httpStatus:201,body:{},receivedAt:START+3600000,requestCorrelationVerified:true};}});
console.log(JSON.stringify({notice:'FICTIONAL OFFLINE MOCK, NO REAL MODEL OR SUBMISSION',result:await pipeline.process(JSON.stringify(f)),mockAtomicPair:exactPair,budgets:{questions:pipeline.status().questions,attempts:pipeline.status().attempts,sources:pipeline.status().sources}},null,2));db.close();
