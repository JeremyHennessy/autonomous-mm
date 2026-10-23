// Disabled candidate: dependency-injected transport only. No global fetch, keys, or startup.
import { parseStrictJSON } from './deps/strict-json.mjs';
const ORIGIN = 'https://www.metaculus.com';
const ATOMIC = '/api/questions/bulk-forecast-comment/';
const encoder = new TextEncoder();
const positive = x => Number.isSafeInteger(x) && x > 0;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => object(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const fail = code => { throw new Error(code); };
const safeHost = host => typeof host === 'string' && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(host) && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host) && !host.includes('..');
const safePath = path => typeof path === 'string' && /^\/[A-Za-z0-9_./-]+$/.test(path) && !path.split('/').some(p => p === '.' || p === '..');

export function createTransport({ fetch, getToken, tournamentSlug, sourceAllowlist = [], now = Date.now,
  timeoutMs = 10000, maxBytes = 131072, maxPages = 5, pageSize = 100, beforeDispatch = () => {} } = {}) {
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
  async function request(url, { method = 'GET', body, auth = true, source = false, beforeDispatch: finalCheck = beforeDispatch } = {}) {
    const startedAt = now();
    if (!positive(startedAt)) fail('clock-invalid');
    const controller = new AbortController();
    let reader;
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
      controller.abort(); if (reader) void reader.cancel().catch(() => {});
      reject(new Error('transport-timeout'));
    }, timeoutMs); });
    const run = async () => {
      const headers = { Accept: source ? 'application/json, text/plain, text/csv' : 'application/json' };
      if (auth) {
        if (new URL(url).origin !== ORIGIN) fail('auth-origin');
        const token = await fixedCredential();
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(token)) fail('auth-unavailable');
        headers.Authorization = `Token ${token}`;
      }
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const init = { method, headers, redirect: 'manual', cache: 'no-store', signal: controller.signal, ...(body === undefined ? {} : {body}) };
      if (controller.signal.aborted) fail('transport-timeout');
      if (typeof finalCheck !== 'function') fail('dispatch-check');
      const checked = finalCheck({url, method});
      if (checked === false) fail('dispatch-veto');
      if (checked && typeof checked.then === 'function') { Promise.resolve(checked).catch(() => {}); fail('dispatch-check-must-be-sync'); }
      // No await between the authoritative synchronous guard and the invocation.
      const responsePromise = fetch(url, init);
      const response = await responsePromise;
      if (controller.signal.aborted) fail('transport-timeout');
      if (!response || response.redirected || (response.url && response.url !== url) || response.status < 200 || response.status >= 300) fail('http-rejected');
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!(source ? ['application/json', 'text/plain', 'text/csv'].includes(contentType) : contentType === 'application/json')) fail('content-type');
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) fail('body-limit');
      if (!response.body || typeof response.body.getReader !== 'function') fail('body-unreadable');
      reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', {fatal:true});
      let text = '', count = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (controller.signal.aborted) fail('transport-timeout');
        if (done) break;
        if (!(value instanceof Uint8Array)) fail('body-unreadable');
        count += value.byteLength;
        if (count > maxBytes) fail('body-limit');
        text += decoder.decode(value, {stream:true});
      }
      text += decoder.decode();
      const receivedAt = now();
      if (!positive(receivedAt) || receivedAt < startedAt) fail('clock-invalid');
      return { text, contentType, httpStatus: response.status, receivedAt, bodyComplete:true, redirected:false, contentRange:response.headers.get('content-range') };
    };
    try { return await Promise.race([run(), timeout]); }
    catch { throw new Error('transport-failed'); } // Never expose URLs, bodies, tokens, or provider errors.
    finally { clearTimeout(timer); controller.abort(); if (reader) void reader.cancel().catch(() => {}); }
  }
  async function json(path, options) {
    const response = await request(ORIGIN + path, options);
    if((options?.method??'GET')==='GET'&&(response.httpStatus!==200||response.contentRange!==null))fail('partial-read');
    try { return {...response, data:parseStrictJSON(response.text)}; } catch { fail('json-invalid'); }
  }
  const pagePath = offset => '/api/posts/?' + new URLSearchParams({tournaments:tournamentSlug, statuses:'open', forecast_type:'binary', include_descriptions:'true', limit:String(pageSize), offset:String(offset)});
  const guardOptions = options => options === undefined ? {} : {beforeDispatch:options.beforeDispatch ?? beforeDispatch};
  const id = value => { if (!positive(value)) fail('id-invalid'); return value; };
  return Object.freeze({
    async discover(options) {
      const pages = [];
      for (let page = 0; page < maxPages; page++) {
        const result = await json(pagePath(page * pageSize), guardOptions(options));
        const data = result.data;
        if (!object(data) || !Array.isArray(data.results) || data.results.length > pageSize || !Object.hasOwn(data,'next') || !Object.hasOwn(data,'previous')) fail('pagination-invalid');
        pages.push(data);
        if (data.next === null) return {pages, traversalComplete:true, snapshotConsistent:false};
        if (data.results.length === 0 || typeof data.next !== 'string') fail('pagination-invalid');
        // Never follow a supplied cursor. Verify every query parameter and construct the next request ourselves.
        let next; try { next = new URL(data.next, ORIGIN); } catch { fail('pagination-invalid'); }
        const expected = new URL(ORIGIN + pagePath((page + 1) * pageSize));
        if (next.origin !== ORIGIN || next.pathname !== expected.pathname || next.username || next.password || next.hash || [...next.searchParams].length !== [...expected.searchParams].length || [...expected.searchParams].some(([k,v]) => next.searchParams.getAll(k).length !== 1 || next.searchParams.get(k) !== v)) fail('pagination-invalid');
      }
      fail('pagination-limit');
    },
    async detail(postId, options) { return (await json(`/api/posts/${id(postId)}/`, guardOptions(options))).data; },
    async history(questionId, options) { const r=await json(`/api/questions/bulk-forecast-read/?question_ids=${id(questionId)}`, guardOptions(options)); if(r.httpStatus!==200||r.contentRange!==null)fail('history-partial'); return {...r,requestQuestionId:questionId,actingUserOverride:false}; },
    async identity(options) { const r=await json('/api/users/me/',guardOptions(options)); if(r.httpStatus!==200||r.contentRange!==null||!object(r.data))fail('identity-partial'); const {id,is_bot,is_active,is_spam}=r.data; return {text:JSON.stringify({id,is_bot,is_active,is_spam}),receivedAt:r.receivedAt}; },
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
      if (url.href !== rawUrl || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !safeHost(url.hostname) || !safePath(url.pathname) || !/^https:\/\/[^/:@]+\//.test(rawUrl) || !allowed.some(rule => rule.host === url.hostname && url.pathname.startsWith(rule.pathPrefix))) fail('source-url');
      const result = await request(rawUrl, {...guardOptions(options), auth:false, source:true, method:'GET', body:undefined});
      if(result.httpStatus!==200||result.contentRange!==null)fail('source-partial');
      return {url:rawUrl, ...result};
    },
  });
}
