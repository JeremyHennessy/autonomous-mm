// Offline integration only; not deployed. Never reads errors.
const STAGES=new Set(['request-build','binding-check','reservation-write','reservation-sync','ai-run','watchdog','status-read','validator','result-write','result-sync','alarm-set','alarm-delete']);
const OUTCOMES=new Set(['entered','resolved','threw','invalid','timed-out']);
const KNOWN_CODES=new Set([5007,5004,3039,3003,5018,5016,3023,3041,5035,5019,5005,3042,3006,3007,3008,3036,3040]);
export function snapshotCodes(binding){
 let h,c,readFailed=false;
 // Inspect only the two documented/source-verified binding status fields.
 try{h=binding?.lastRequestHttpStatusCode;}catch{readFailed=true;}
 try{c=binding?.lastRequestInternalStatusCode;}catch{readFailed=true;}
 return {httpStatus:Number.isInteger(h)&&h>=100&&h<=599?h:null,internalCode:KNOWN_CODES.has(c)?c:null,statusReadFailed:readFailed};
}
export function diagnostic(stage,outcome,{dispatchReserved=false,runInvoked=false,providerResolved=false,codes=null}={}){
 if(!STAGES.has(stage)||!OUTCOMES.has(outcome)||![dispatchReserved,runInvoked,providerResolved].every(v=>typeof v==='boolean')||runInvoked&&!dispatchReserved||providerResolved&&!runInvoked)throw Error('invalid-diagnostic');
 // Do not spread arbitrary objects into a receipt; accept allowlisted primitives only.
 const h=codes?.httpStatus,c=codes?.internalCode;
 return {schema:1,stage,outcome,dispatchReserved,runInvoked,providerResolved,httpStatus:Number.isInteger(h)&&h>=100&&h<=599?h:null,internalCode:KNOWN_CODES.has(c)?c:null,statusReadFailed:codes?.statusReadFailed===true};
}
