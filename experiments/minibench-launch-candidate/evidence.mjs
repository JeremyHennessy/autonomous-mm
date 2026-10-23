// Pure bounded extraction: no DOM, executable markup, requests, or source authority.
export const SOURCE_RAW_LIMIT = 65536;
export const EXCERPT_LIMIT = 1200;
const encoder = new TextEncoder();
const types = new Set(['text/html','text/plain','text/csv','application/json']);
const blocked = new Set(['head','script','style','nav','template','noscript','iframe','object','embed','svg','math','form','footer']);
const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”'};
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (whole, entity) => {
    if (entity[0] !== '#') return entities[entity] ?? whole;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ' ';
  });
}
function visibleHtml(html) {
  const stack = [];
  let output = '', at = 0;
  while (at < html.length) {
    // Raw-text contents cannot create fake nested markup or terminate a hidden ancestor.
    const top = stack.at(-1);
    if (top && ['script','style','textarea','title'].includes(top.name)) {
      const close = new RegExp(`</${top.name}\\s*>`, 'ig'); close.lastIndex = at;
      const match = close.exec(html);
      if (!match) throw Error('html-unclosed-raw');
      at = match.index;
    }
    if (html.startsWith('<!--', at)) {
      const end = html.indexOf('-->',at+4); if (end < 0) throw Error('html-unclosed-comment');
      at = end+3; continue;
    }
    if (html[at] !== '<') {
      let end = html.indexOf('<',at); if (end < 0) end = html.length;
      if (!stack.some(x=>x.hidden)) output += html.slice(at,end);
      at = end; continue;
    }
    let end = at+1, quote = '';
    for (; end < html.length; end++) {
      const ch = html[end];
      if (quote) { if (ch === quote) quote = ''; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') break;
    }
    if (end === html.length) throw Error('html-unclosed-tag');
    const token = html.slice(at,end+1); at=end+1;
    if (/^<!doctype\s+html\s*>$/i.test(token)) continue;
    const match = /^<\s*(\/?)\s*([a-z][a-z0-9:-]*)([\s\S]*?)>$/i.exec(token);
    if (!match) throw Error('html-unsupported-markup');
    const [, closing, rawName, attrs] = match, name = rawName.toLowerCase();
    if (closing) {
      const index = stack.map(x=>x.name).lastIndexOf(name);
      if (index >= 0) stack.splice(index);
    } else if (!voids.has(name)) {
      const hidden = blocked.has(name) || ['textarea','title'].includes(name) || /(?:^|\s)(?:hidden|inert)(?:\s|=|\/|$)|\baria-hidden\s*=\s*(?:"true"|'true'|true\b)|\bstyle\s*=[\s\S]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attrs);
      stack.push({name,hidden});
      if (stack.length > 256) throw Error('html-depth');
    }
    if (!stack.some(x=>x.hidden)) output+=' ';
  }
  // An unterminated suppressed subtree is ambiguous rather than evidence.
  if (stack.some(x=>x.hidden)) throw Error('html-unclosed-hidden');
  return decodeEntities(output);
}
export function extractEvidence(raw, contentType='text/plain') {
  if (typeof raw !== 'string' || encoder.encode(raw).byteLength > SOURCE_RAW_LIMIT || !types.has(contentType)) throw Error('unsupported-evidence');
  const visible = (contentType === 'text/html' ? visibleHtml(raw) : raw)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,' ').replace(/\s+/gu,' ').trim();
  if (!visible) throw Error('empty-evidence');
  let text = '', bytes = 0;
  for (const char of visible) {
    const size=encoder.encode(char).byteLength;
    if (bytes+size > EXCERPT_LIMIT) break;
    text+=char;bytes+=size;
  }
  return {text,publishedAt:null,semanticFreshness:'unknown-model-must-assess',representation:'bounded-excerpt',fullSource:false,freshnessProven:false,truncated:text.length<visible.length};
}
