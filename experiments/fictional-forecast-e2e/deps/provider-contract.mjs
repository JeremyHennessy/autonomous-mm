// Generation contract only. Strict semantic validator remains unchanged.
import {requestFixture} from './validator.mjs';
export function compatibleRequest(context){
 const r=requestFixture(context); // validates synthetic context before constructing request
 const p=r.input.response_format.json_schema.properties;
 r.input.response_format.json_schema={type:'object',additionalProperties:false,required:['schema_version','question_id','status','probability','source_ids','rationale'],properties:{schema_version:p.schema_version,question_id:p.question_id,status:p.status,probability:{type:['number','null']},source_ids:{type:'array',items:{type:'string'}},rationale:{type:'string'}}};
 return r;
}
