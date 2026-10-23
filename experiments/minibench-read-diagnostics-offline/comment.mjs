// Pure serialization only: source authority is the fetched evidence array, never model prose.
export const COMMENT_BYTE_LIMIT=4000;
export function formatForecastComment(value,evidence){
 if(!value||value.status!=='forecast'||!Array.isArray(evidence)||!evidence.length||evidence.length>3||!Array.isArray(value.source_ids)||!value.source_ids.length||value.source_ids.length>3||new Set(value.source_ids).size!==value.source_ids.length)throw Error('comment-sources');
 if(['criterion_summary','uncertainty','rationale'].some(key=>typeof value[key]!=='string'||!value[key].trim()))throw Error('comment-text');
 const lines=value.source_ids.map(id=>{
  if(typeof id!=='string'||!/^S-[1-3]$/.test(id))throw Error('comment-sources');
  const source=evidence[Number(id.slice(2))-1];
  if(!source)throw Error('comment-sources');
  const {url,retrievedAt,contentHash}=source;
  // Reject ambiguous/control-bearing URLs rather than normalizing or inventing provenance.
  if(typeof url!=='string'||/[\s\u0000-\u001f\u007f-\u009f]/u.test(url))throw Error('comment-source-url');
  let parsed;try{parsed=new URL(url);}catch{throw Error('comment-source-url');}
  if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password||parsed.hash||parsed.href!==url)throw Error('comment-source-url');
  if(!Number.isSafeInteger(retrievedAt)||retrievedAt<=0||!Number.isFinite(new Date(retrievedAt).getTime()))throw Error('comment-source-time');
  if(typeof contentHash!=='string'||!/^[a-f0-9]{64}$/.test(contentHash))throw Error('comment-source-hash');
  return `${id}: ${url} | retrievedAt: ${new Date(retrievedAt).toISOString()} | evidenceSHA256: ${contentHash}`;
 });
 const comment=`Interpretation (model judgment): ${value.criterion_summary}\nUncertainty: ${value.uncertainty}\n${value.rationale}\n${lines.join('\n')}`;
 if(new TextEncoder().encode(comment).byteLength>COMMENT_BYTE_LIMIT)throw Error('comment-limit');
 return comment;
}
