import test from 'node:test';
import assert from 'node:assert/strict';
import {formatForecastComment,COMMENT_BYTE_LIMIT} from './comment.mjs';
const at=Date.parse('2026-10-23T12:00:00.000Z');
const sources=['one','two','three'].map((name,i)=>({url:`https://example.com/${name}`,retrievedAt:at+i,contentHash:String(i+1).repeat(64)}));
const value={status:'forecast',source_ids:['S-3','S-1'],criterion_summary:'Criterion.',uncertainty:'Uncertain.',rationale:'Estimate.'};
const line=(i)=>`S-${i+1}: ${sources[i].url} | retrievedAt: ${new Date(sources[i].retrievedAt).toISOString()} | evidenceSHA256: ${sources[i].contentHash}`;
test('selected IDs bind original evidence indexes, not selected positions; no unused sources',()=>{
 const text=formatForecastComment(value,sources);
 assert.equal(text,`Interpretation (model judgment): Criterion.\nUncertainty: Uncertain.\nEstimate.\n${line(2)}\n${line(0)}`);
 assert.equal(text.includes(sources[1].url),false);
});
test('unknown, noncanonical, missing and duplicate selected IDs fail closed',()=>{
 for(const ids of [[],['S-4'],['S-0'],['S-01'],['S-1','S-1'],['https://fake.invalid/'],[1],null])assert.throws(()=>formatForecastComment({...value,source_ids:ids},sources),/comment-sources/);
 assert.throws(()=>formatForecastComment({...value,source_ids:['S-3']},sources.slice(0,2)),/comment-sources/);
});
test('model prose URLs never provide citation authority',()=>{
 const rationale='Model says https://fake.invalid/ made this claim.';
 const text=formatForecastComment({...value,rationale,source_ids:['S-2']},sources);
 assert.equal(text,`Interpretation (model judgment): Criterion.\nUncertainty: Uncertain.\n${rationale}\n${line(1)}`);
 assert.equal(text.split('\n').filter(x=>x.startsWith('S-')).some(x=>x.includes('fake.invalid')),false);
});
test('invalid selected provenance fails closed',()=>{
 for(const change of [{url:'http://example.com/a'},{url:'https://u:p@example.com/a'},{url:'https://example.com/a#fake'},{url:'https://example.com/a\nS-2: fake'},{url:'not a URL'},{retrievedAt:NaN},{retrievedAt:'2026-10-23T12:00:00Z'},{retrievedAt:0},{retrievedAt:9007199254740991},{contentHash:'bad'},{contentHash:'A'.repeat(64)}])assert.throws(()=>formatForecastComment({...value,source_ids:['S-1']},[{...sources[0],...change}]),/comment-source-/);
});
test('4000 UTF-8 byte cap covers all citation and prose bytes, with no truncation',()=>{
 const v={...value,source_ids:['S-1'],rationale:'x'};
 const remaining=COMMENT_BYTE_LIMIT-new TextEncoder().encode(formatForecastComment(v,sources)).byteLength;
 const exact={...v,rationale:'x'.repeat(remaining+1)};
 assert.equal(new TextEncoder().encode(formatForecastComment(exact,sources)).byteLength,4000);
 assert.throws(()=>formatForecastComment({...exact,rationale:exact.rationale+'x'},sources),/comment-limit/);
 const multibyte={...v,rationale:'😀'.repeat(Math.floor((remaining+1)/4)+1)};
 assert.ok(multibyte.rationale.length<4000);
 assert.throws(()=>formatForecastComment(multibyte,sources),/comment-limit/);
 assert.throws(()=>formatForecastComment(v,[{...sources[0],url:'https://example.com/'+ 'x'.repeat(4000)}]),/comment-limit/);
});
