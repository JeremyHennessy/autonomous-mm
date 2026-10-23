// Disabled candidate: dependency-injected transport only. No global fetch, keys, or startup.
import { createHash } from 'node:crypto';
import { SOURCE_RAW_LIMIT } from './evidence.mjs';
import { parseStrictJSON } from './deps/strict-json.mjs';
import {createReadDiagnostic, diagnosticContentType} from './read-transport-diagnostics.mjs';
import { projectMetadata } from './metadata-projection.mjs';
const ORIGIN = 'https://www.metaculus.com';
const ATOMIC = '/api/questions/bulk-forecast-comment/';
const encoder = new TextEncoder();
const positive = x => Number.isSafeInteger(x) && x > 0;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => object(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const internalFailure = Symbol('transport-internal-failure');
const failures = new WeakMap();
const fail = code => { const error=new Error(code); error[internalFailure]=code; failures.set(error,code); throw error; };
const failureCode = error => (error !== null && (typeof error==='object'||typeof error==='function')) ? failures.get(error) : undefined;
const safeHost = host => typeof host === 'string' && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(host) && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host) && !host.includes('..');
const safePath = path => typeof path === 'string' && /^\/[A-Za-z0-9_./-]+$/.test(path) && !path.split('/').some(p => p === '.' || p === '..');

export function createTransport({ fetch, getToken, tournamentSlug, sourceAllowlist = [], now = Date.now,
  timeoutMs = 10000, maxBytes = 131072, maxPages = 5, pageSize = 20, beforeDispatch = () => {} } = {}) {
  if (typeof fetch !== 'function' || typeof getToken !== 'function' || typeof now !== 'function' || typeof beforeDispatch !== 'function') fail('transport-config');
  if (typeof tournamentSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(tournamentSlug) || /^(current|latest|active)$/.test(tournamentSlug)) fail('round-config');
  if (!positive(timeoutMs) || timeoutMs > 10000 || !positive(maxBytes) || maxBytes > 131072 || !positive(maxPages) || maxPages > 20 || !positive(pageSize) || pageSize > 100) fail('bounds-config');
  if (!Array.isArray(sourceAllowlist) || sourceAllowlist.length > 20) fail('source-config');
  const allowed = sourceAllowlist.map(rule => {
    if (!exact(rule, ['host', 'pathPrefix']) || !safeHost(rule.host) || !safePath(rule.pathPrefix) || !rule.pathPrefix.endsWith('/')) fail('source-config');
    return Object.freeze({host: rule.host, pathPrefix: rule.pathPrefix});
  });
  Object.freeze(allowed);

  let credentialPromise;
  const fixedCredential=()=>credentialPromise??=(Promise.resolve().then(()=>getToken()));
  async function request(url, { method = 'GET', body, auth = true, source = false, beforeDispatch: finalCheck = beforeDispatch, diagnostic: d } = {}) {
    d?.set({stage:'clock'});
    const startedAt = now();
    if (!positive(startedAt)) fail('clock-invalid');
    const controller = new AbortController();
    let reader;
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
      controller.abort(); if (reader) { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {} }
      const error=new Error('transport-timeout');failures.set(error,'transport-timeout');reject(error);
    }, timeoutMs); });
    const run = async () => {
      const byteLimit = source ? Math.min(maxBytes, SOURCE_RAW_LIMIT) : maxBytes;
      const headers = { Accept: source ? 'application/json, text/plain, text/csv, text/html' : 'application/json' };
      if (auth) {
        if (new URL(url).origin !== ORIGIN) fail('auth-origin');
        await d?.emit({stage:'credential'});
        const token = await fixedCredential();
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(token)) fail('auth-unavailable');
        headers.Authorization = `Token ${token}`;
      }
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const init = { method, headers, redirect: 'manual', cache: 'no-store', signal: controller.signal, ...(body === undefined ? {} : {body}) };
      await d?.emit({stage:'dispatch-intent'});
      if (controller.signal.aborted) fail('transport-timeout');
      if (typeof finalCheck !== 'function') fail('dispatch-check');
      d?.set({stage:'dispatch-guard'});
      const checked = finalCheck({url, method});
      if (checked === false) fail('dispatch-veto');
      if (checked && typeof checked.then === 'function') { Promise.resolve(checked).catch(() => {}); fail('dispatch-check-must-be-sync'); }
      // No await between the authoritative synchronous guard and the invocation.
      d?.set({stage:'fetch',attempted:true});
      const responsePromise = fetch(url, init);
      const response = await responsePromise;
      d?.set({stage:'response',resolved:true});
      if (controller.signal.aborted) fail('transport-timeout');
      if (!response) fail('response-invalid');
      const status=response.status;
      if(!Number.isInteger(status)||status<100||status>599)fail('response-invalid');
      d?.set({httpStatus:status});
      if(response.redirected || (response.url && response.url !== url) || status>=300&&status<400)fail('http-redirect');
      if(status===401||status===403)fail('http-auth');
      if(status===429)fail('http-rate-limit');
      if(status<200||status>=300)fail('http-rejected');
      d?.set({stage:'headers'});
      if (!response.body || typeof response.body.getReader !== 'function') fail('body-unreadable');
      reader = response.body.getReader();
      if (source && (response.status !== 200 || response.headers.get('content-range') !== null)) fail('source-partial');
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      d?.set({contentType:diagnosticContentType(contentType)});
      if (!(source ? ['application/json', 'text/plain', 'text/csv', 'text/html'].includes(contentType) : contentType === 'application/json')) fail('content-type');
      if (source) {
        const charset = /;\s*charset\s*=\s*[\"']?([^;\s\"']+)/i.exec(response.headers.get('content-type') || '');
        if (charset && !['utf-8','utf8','us-ascii'].includes(charset[1].toLowerCase())) fail('content-type');
      }
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > byteLimit)) fail('body-limit');
      const decoder = new TextDecoder('utf-8', {fatal:true});
      const rawHash = source ? createHash('sha256') : null;
      const decode = (value, options) => { try { return decoder.decode(value, options); } catch { fail('source-encoding'); } };
      let text = '', count = 0, chunks = 0;
      // Persist once on entering the streaming stage, not once per attacker-sized chunk.
      await d?.emit({stage:'body-read'});
      while (true) {
        const {done, value} = await reader.read();
        if (controller.signal.aborted) fail('transport-timeout');
        if (done) break;
        if (source && ++chunks > 1024) fail('source-chunk-limit');
        if (!(value instanceof Uint8Array)) fail('body-unreadable');
        count += value.byteLength;
        d?.set({bodyBytes:count});
        if (count > byteLimit) fail('body-limit');
        if(rawHash)rawHash.update(value);
        text += decode(value, {stream:true});
      }
      text += decode();
      const receivedAt = now();
      if (!positive(receivedAt) || receivedAt < startedAt) fail('clock-invalid');
      return { text, contentType, httpStatus: response.status, receivedAt, bodyComplete:true, redirected:false, contentRange:response.headers.get('content-range'), ...(rawHash ? {rawContentHash:rawHash.digest('hex')} : {}) };
    };
    try { return await Promise.race([run(), timeout]); }
    catch (cause) {
      const error=new Error('transport-failed'); failures.set(error,failureCode(cause)??(d?.snapshot().finalError==='diagnostic-storage'?'diagnostic-storage':'boundary-exception')); // Never expose URLs, bodies, tokens, or provider errors.
      if(source && ['content-type','body-limit','source-encoding','source-chunk-limit','source-partial'].includes(failureCode(cause))) error.safeAbstention=true;
      throw error;
    }
    finally { clearTimeout(timer); controller.abort(); if (reader) { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {} } }
  }
  async function json(path, options) {
    const response = await request(ORIGIN + path, options);
    if((options?.method??'GET')==='GET'&&(response.httpStatus!==200||response.contentRange!==null))fail('partial-read');
    options?.diagnostic?.set({stage:'json-parse',parse:'pending'});
    try { const data=parseStrictJSON(response.text);options?.diagnostic?.set({parse:'valid'});return {...response,data}; } catch { options?.diagnostic?.set({parse:'invalid'});fail('json-invalid'); }
  }
  const pagePath = offset => '/api/posts/?' + new URLSearchParams({tournaments:tournamentSlug, statuses:'open', forecast_type:'binary', include_descriptions:'true', limit:String(pageSize), offset:String(offset)});
  const guardOptions = options => options === undefined ? {} : {beforeDispatch:options.beforeDispatch ?? beforeDispatch};
  const id = value => { if (!positive(value)) fail('id-invalid'); return value; };
    async function read(endpoint, options, operation) {
    let callback, d;
    try {
      // Accessor failure is attributed before reading user-controlled options.
      d=createReadDiagnostic(endpoint,undefined);
      d.set({stage:'options'});
      callback=options?.onDiagnostic;
      d=createReadDiagnostic(endpoint,callback);
      await d.emit({stage:'intent'});
      const result=await operation(d,{...guardOptions(options),diagnostic:d});
      await d.finish();
      return result;
    } catch(cause) {
      const safe=failureCode(cause)??(d?.snapshot().finalError==='diagnostic-storage'?'diagnostic-storage':'boundary-exception');
      try{await d?.finish(safe);}catch{}
      const error=new Error(safe==='pagination-limit'?'pagination-limit':'transport-failed');
      Object.defineProperty(error,'readDiagnostic',{value:d?.snapshot()??Object.freeze({endpoint,stage:'options',finalError:'boundary-exception'}),enumerable:true});
      throw error;
    }
  }
  return Object.freeze({
    async metadata(options) {return read('metadata',options,async(d,o)=>{
      const r=await json(`/api/projects/tournaments/${tournamentSlug}/`,o);
      d.set({stage:'metadata-projection',shape:object(r.data)?'object':'invalid'});
      d.set({requiredFields:object(r.data)&&['id','slug','start_date','forecasting_end_date','close_date'].every(k=>Object.hasOwn(r.data,k))?'present':'missing-metadata'});
      const projection=projectMetadata(r.text);
      if(!projection.ok)fail('metadata-invalid');
      d.set({shape:'valid'});
      return {metadata:projection.metadata,receivedAt:r.receivedAt};
    });},
    async discover(options) {return read('discovery',options,async(d,o)=>{
      const pages=[];
      for(let page=0;page<maxPages;page++){
        d.set({pageIndex:page,attempted:false,resolved:false,httpStatus:null,contentType:'unknown',bodyBytes:0,parse:'not-started',shape:'not-checked',requiredFields:'not-checked'});
        const result=await json(pagePath(page*pageSize),o),data=result.data;
        d.set({stage:'page-shape',shape:object(data)?'object':'invalid'});
        if(!object(data)||!Array.isArray(data.results)||data.results.length>pageSize){d.set({shape:'invalid'});fail('page-shape');}
        d.set({requiredFields:Object.hasOwn(data,'next')&&Object.hasOwn(data,'previous')?'present':'missing-pagination'});
        if(!Object.hasOwn(data,'next')||!Object.hasOwn(data,'previous'))fail('pagination-invalid');
        d.set({shape:'valid',stage:'pagination'});
        pages.push(data);
        if(data.next===null)return {pages,traversalComplete:true,snapshotConsistent:false};
        if(typeof data.next!=='string')fail('pagination-invalid');
        let next;try{next=new URL(data.next,ORIGIN);}catch{fail('pagination-invalid');}
        const expected=new URL(ORIGIN+pagePath((page+1)*pageSize));
        if(next.origin!==ORIGIN||next.pathname!==expected.pathname||next.username||next.password||next.hash||[...next.searchParams].length!==[...expected.searchParams].length||[...expected.searchParams].some(([k,v])=>next.searchParams.getAll(k).length!==1||next.searchParams.get(k)!==v))fail('pagination-invalid');
        // CountlessLimitOffsetPagination emits next even for the final short/empty page.
        // Validate its shape and origin first; never follow the supplied cursor.
        if(data.results.length<pageSize)return {pages,traversalComplete:true,snapshotConsistent:false};
        await d.emit({stage:'page-complete'});
      }
      fail('pagination-limit');
    });},
    async detail(postId,options){return read('detail',options,async(d,o)=>{const r=await json(`/api/posts/${id(postId)}/`,o);d.set({stage:'detail-shape',shape:object(r.data)?'object':'invalid'});return r.data;});},
    async history(questionId,options){return read('history',options,async(d,o)=>{const r=await json(`/api/questions/bulk-forecast-read/?question_ids=${id(questionId)}`,o);d.set({stage:'history-shape',shape:object(r.data)?'object':'invalid'});return {...r,requestQuestionId:questionId,actingUserOverride:false};});},
    async identity(options){return read('identity',options,async(d,o)=>{const r=await json('/api/users/me/',o);d.set({stage:'identity-shape',shape:object(r.data)?'object':'invalid'});if(!object(r.data))fail('identity-partial');
      const fields=['id','is_bot','is_active','is_spam'];
      d.set({requiredFields:!Object.hasOwn(r.data,'is_spam')?'missing-is-spam':fields.every(k=>Object.hasOwn(r.data,k))?'present':'missing-identity'});
      const {id,is_bot,is_active,is_spam}=r.data;
      d.set({shape:!positive(id)||![is_bot,is_active,is_spam].every(v=>typeof v==='boolean')?'invalid-fields':'valid'});return {text:JSON.stringify({id,is_bot,is_active,is_spam}),receivedAt:r.receivedAt};
    });},
    async submit(descriptor, options) {
      let requestDigest = null;
      try {
        if (!object(descriptor) || typeof descriptor.digest !== 'string' || !/^[a-f0-9]{64}$/.test(descriptor.digest)) fail('descriptor-invalid');
        requestDigest = descriptor.digest;
        if (typeof descriptor.bodyJson !== 'string' || encoder.encode(descriptor.bodyJson).length > 8192) fail('descriptor-invalid');
        const body = parseStrictJSON(descriptor.bodyJson);
        if (!exact(body,['forecasts','comments']) || !Array.isArray(body.forecasts) || body.forecasts.length !== 1 || !Array.isArray(body.comments) || body.comments.length !== 1) fail('descriptor-invalid');
        const [f] = body.forecasts, [c] = body.comments;
        if (!exact(f,['question','probability_yes']) || !positive(f.question) || typeof f.probability_yes !== 'number' || !Number.isFinite(f.probability_yes) || f.probability_yes < .001 || f.probability_yes > .999 || !exact(c,['on_post','text','is_private','included_forecast']) || !positive(c.on_post) || typeof c.text !== 'string' || !c.text.trim() || encoder.encode(c.text).length > 4000 || c.is_private !== true || c.included_forecast !== true) fail('descriptor-invalid');
        const result = await json(ATOMIC, {...guardOptions(options), method:'POST', body:descriptor.bodyJson});
        const acknowledged = result.httpStatus === 201 && exact(result.data,[]);
        return {state: acknowledged ? 'ACKNOWLEDGED' : 'UNKNOWN', requestDigest, httpStatus:result.httpStatus, receivedAt:result.receivedAt, retryAllowed:false};
      } catch { return {state:'UNKNOWN', requestDigest, retryAllowed:false}; }
    },
    async source(rawUrl, options) {
      if (typeof rawUrl !== 'string' || rawUrl.length > 2048) fail('source-url');
      let url; try { url = new URL(rawUrl); } catch { fail('source-url'); }
      if (url.href !== rawUrl || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !safeHost(url.hostname) || /(^|\.)metaculus\.com$/.test(url.hostname) || !safePath(url.pathname) || !/^https:\/\/[^/:@]+\//.test(rawUrl) || !allowed.some(rule => rule.host === url.hostname && url.pathname.startsWith(rule.pathPrefix))) fail('source-url');
      const result = await request(rawUrl, {...guardOptions(options), auth:false, source:true, method:'GET', body:undefined});
      if(result.httpStatus!==200||result.contentRange!==null)fail('source-partial');
      return {url:rawUrl, ...result};
    },
  });
}
