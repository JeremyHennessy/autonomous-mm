// Pure offline integration proposal. Receipt fields below are LOCAL trusted transport
// facts, NOT Metaculus provider properties. No HTTP, credentials, or activation.
import {parseStrictJSON} from './deps/strict-json.mjs';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>Number.isSafeInteger(x)&&x>0;
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const no=reason=>({verifiedEmpty:false,reason,liveUseAllowed:false});
function parse(s) { if(typeof s!=='string'||new TextEncoder().encode(s).length>65536)throw Error();return parseStrictJSON(s); }
const fresh=(stamp,now,age)=>Number.isSafeInteger(stamp)&&stamp>0&&stamp<=now&&now-stamp<=age;
export function verifyEmptyOwnHistory(rawHistory, rawIdentity, receipt, context) {
  let history,identity;
  try {history=parse(rawHistory);identity=parse(rawIdentity);}catch{return no('malformed_or_oversized_json');}
  if(!obj(context)||!id(context.questionId)||!id(context.accountId)||!Number.isSafeInteger(context.now)||context.now<=0||!Number.isSafeInteger(context.maxAgeMs)||context.maxAgeMs<1||context.maxAgeMs>60000)return no('invalid_context');
  if(!obj(identity)||identity.id!==context.accountId||identity.is_bot!==true||identity.is_active!==true||identity.is_spam!==false)return no('identity_unknown_mismatch_or_spam');
  if(!obj(receipt)||receipt.httpStatus!==200||receipt.contentRange!==null||receipt.bodyComplete!==true||receipt.redirected!==false||receipt.requestQuestionId!==context.questionId||receipt.credentialIdentityId!==context.accountId||receipt.actingUserOverride!==false)return no('unverified_transport');
  if(!fresh(receipt.receivedAt,context.now,context.maxAgeMs)||!fresh(receipt.identityReceivedAt,context.now,context.maxAgeMs)||receipt.identityReceivedAt>receipt.receivedAt)return no('stale_or_unordered_evidence');
  // Exact top-level schema rejects unexpected pagination/partial-data extensions.
  if(!exact(history,['results'])||!Array.isArray(history.results)||history.results.length!==1)return no('missing_duplicate_or_unexpected_question');
  const row=history.results[0];
  if(!exact(row,['question_id','forecasts'])||row.question_id!==context.questionId||!Array.isArray(row.forecasts))return no('invalid_question_history');
  // ANY record disqualifies. No filtering of malformed, ended, or preregistered forecasts.
  if(row.forecasts.length!==0)return no('prior_or_uninterpretable_forecast');
  return {verifiedEmpty:true,accountId:context.accountId,questionId:context.questionId,observedAt:receipt.receivedAt,scope:'complete-api-visible-stored-history',liveUseAllowed:false};
}
