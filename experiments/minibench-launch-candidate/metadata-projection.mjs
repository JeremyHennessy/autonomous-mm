import {parseStrictJSON} from './deps/strict-json.mjs';
const fields=['id','slug','start_date','forecasting_end_date','close_date'];
function date(value){if(value===null)return true;if(typeof value!=='string'||value.length>40)return false;const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/.exec(value);if(!m)return false;const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),days=new Date(Date.UTC(year,month,0)).getUTCDate();return year>=1970&&month>=1&&month<=12&&day>=1&&day<=days&&hour<24&&minute<60&&second<60&&Number.isFinite(Date.parse(value));}
export function projectMetadata(text){
 let value;try{if(typeof text!=='string'||new TextEncoder().encode(text).length>65536)throw Error();value=parseStrictJSON(text);}catch{return {ok:false,parse:'invalid'};}
 if(!value||typeof value!=='object'||Array.isArray(value)||!fields.every(k=>Object.hasOwn(value,k)))return {ok:false,parse:'valid'};
 if(!Number.isSafeInteger(value.id)||value.id<=0||!(value.slug===null||typeof value.slug==='string'&&/^[A-Za-z0-9_-]{0,200}$/.test(value.slug))||!fields.slice(2).every(k=>date(value[k])))return {ok:false,parse:'valid'};
 return {ok:true,parse:'valid',metadata:{id:value.id,slug:value.slug,start_date:value.start_date,forecasting_end_date:value.forecasting_end_date,close_date:value.close_date}};
}
