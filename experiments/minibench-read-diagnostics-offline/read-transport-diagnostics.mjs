// Strictly allowlisted telemetry: never copy provider values, errors, URLs, or IDs.
export const READ_ENDPOINTS = Object.freeze(['metadata','identity','discovery','detail','history']);
export function createReadDiagnostic(endpoint, callback) {
  if (!READ_ENDPOINTS.includes(endpoint)) throw new Error('diagnostic-config');
  const state = {version:1,endpoint,pageIndex:0,stage:'intent',failureStage:null,attempted:false,resolved:false,httpStatus:null,contentType:'unknown',bodyBytes:0,parse:'not-started',shape:'not-checked',requiredFields:'not-checked',finalError:null};
  let closed=false;
  const snapshot=()=>Object.freeze({...state});
  return {
    set(patch){if(!closed)Object.assign(state,patch);},
    snapshot,
    async emit(patch={}) {
      if(closed)return;
      Object.assign(state,patch);
      if(callback!==undefined){
        if(typeof callback!=='function'){state.finalError='diagnostic-storage';throw new Error('diagnostic-storage');}
        try{await callback(snapshot());}catch{state.finalError='diagnostic-storage';throw new Error('diagnostic-storage');}
      }
    },
    async finish(error=null){
      if(closed)return snapshot();
      state.finalError=state.finalError??error;
      if(state.finalError)state.failureStage=state.stage;
      try{await this.emit({stage:state.finalError?'failed':'complete'});}finally{
        if(state.finalError){state.failureStage??=state.stage;state.stage='failed';}
        closed=true;
      }
      return snapshot();
    },
  };
}
export function diagnosticContentType(value){
  return ['application/json','text/plain','text/csv','text/html'].includes(value)?value:'other';
}
const stages=['intent','options','clock','credential','dispatch-intent','dispatch-guard','fetch','response','headers','body-read','json-parse','metadata-projection','page-shape','pagination','page-complete','detail-shape','history-shape','identity-shape','complete','failed'];
const errors=['clock-invalid','auth-origin','auth-unavailable','transport-timeout','dispatch-check','dispatch-veto','dispatch-check-must-be-sync','response-invalid','http-redirect','http-auth','http-rate-limit','http-rejected','body-unreadable','source-partial','content-type','body-limit','source-encoding','source-chunk-limit','partial-read','json-invalid','metadata-invalid','pagination-invalid','pagination-limit','page-shape','id-invalid','identity-partial','identity-shape','identity-required-fields','identity-field-types','history-partial','history-shape','detail-shape','boundary-exception','diagnostic-storage'];
export function safeReadDiagnostic(value){
  try {
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const own=(key)=>{const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
    const out={};
    for(const key of ['version','endpoint','pageIndex','stage','failureStage','attempted','resolved','httpStatus','contentType','bodyBytes','parse','shape','requiredFields','finalError'])out[key]=own(key);
    if(out.version!==1||!READ_ENDPOINTS.includes(out.endpoint)||!Number.isInteger(out.pageIndex)||out.pageIndex<0||out.pageIndex>19||!stages.includes(out.stage)||!(out.failureStage===null||stages.includes(out.failureStage))||typeof out.attempted!=='boolean'||typeof out.resolved!=='boolean'||!(out.httpStatus===null||Number.isInteger(out.httpStatus)&&out.httpStatus>=100&&out.httpStatus<=599)||!['unknown','other','application/json','text/plain','text/csv','text/html'].includes(out.contentType)||!Number.isSafeInteger(out.bodyBytes)||out.bodyBytes<0||!['not-started','pending','valid','invalid'].includes(out.parse)||!['not-checked','object','invalid','invalid-fields','valid'].includes(out.shape)||!['not-checked','present','missing-metadata','missing-pagination','missing-is-spam','missing-identity'].includes(out.requiredFields)||!(out.finalError===null||errors.includes(out.finalError)))return null;
    return Object.freeze(out);
  }catch{return null;}
}
