import { createHash } from 'node:crypto';
import { parseStrictJSON } from './deps/strict-json.mjs';

// DISABLED candidate, tested only with synthetic fixtures. Local trust assertions, not provider
// response fields. Semantic interpretation is explicitly delegated to one bounded model judgment.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = v => Number.isSafeInteger(v) && v > 0;
const own = (o, k) => Object.hasOwn(o, k);
const fail = reason => ({ admitted: false, reason, liveUseAllowed: false });
const evidenceFail = reason => ({ ok: false, reason });
const MAX_JSON_BYTES = 65536;
function json(value) {
  // Objects are a convenience for trusted synthetic fixture builders only. Raw
  // external input must stay serialized so duplicate keys cannot be erased.
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_JSON_BYTES) throw Error('size');
  return parseStrictJSON(text);
}
function time(v) {
  if(typeof v!=='string')return NaN;
  const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/.exec(v);
  if(!m)return NaN;
  const n=Date.parse(v),calendar=new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  if(!Number.isFinite(n)||calendar.getUTCFullYear()!==Number(m[1])||calendar.getUTCMonth()+1!==Number(m[2])||calendar.getUTCDate()!==Number(m[3])||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return NaN;
  // Bound sub-millisecond values conservatively: no silent early-open rounding.
  if(m[7]&&m[7].length>3&&/[1-9]/.test(m[7].slice(3)))return NaN;
  return n;
}
function httpsUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password && !u.hash && u.port === '' && u.href === s;
  } catch { return false; }
}
const exactKeys = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => own(v, k));
const fresh = (stamp, now, age) => Number.isFinite(time(stamp)) && time(stamp) <= now && now - time(stamp) <= age;

export function selectSources(text, allowlist) {
  if(typeof text!=='string'||!Array.isArray(allowlist)) return [];
  const urls=[...new Set(text.match(/https:\/\/[^\s<>"'`\])]+/g)??[])];
  return urls.filter(raw=>{
    try { const u=new URL(raw); return httpsUrl(raw)&&!u.search&&!/%/.test(raw)&&/^\/[A-Za-z0-9_./-]+$/.test(u.pathname)&&!u.pathname.split('/').some(p=>p==='.'||p==='..')&&allowlist.some(r=>object(r)&&u.hostname===r.host&&typeof r.pathPrefix==='string'&&r.pathPrefix.endsWith('/')&&u.pathname.startsWith(r.pathPrefix)); } catch{return false;}
  }).slice(0,3);
}

export function admit(rawPost, rawHistory, rawConfig, now) {
  let post, history, config;
  try { post = json(rawPost); history = json(rawHistory); config = json(rawConfig); } catch { return fail('malformed_json'); }
  const clock = typeof now === 'number' ? now : time(now);
  if (!object(config) || !id(config.roundId) || !id(config.accountId) || typeof config.roundSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.roundSlug) || /^(current|latest)$/.test(config.roundSlug)) return fail('invalid_frozen_config');
  if (!Number.isFinite(clock) || !Number.isFinite(time(config.roundOpensAt)) || !Number.isFinite(time(config.roundClosesAt)) || !(time(config.roundOpensAt) <= clock && clock < time(config.roundClosesAt))) return fail('outside_round_window');
  if (!Number.isSafeInteger(config.maxAgeMs) || config.maxAgeMs < 1 || config.maxAgeMs > 60000 || !fresh(config.observedAt, clock, config.maxAgeMs) || !fresh(config.historyObservedAt, clock, config.maxAgeMs) || time(config.historyObservedAt) < time(config.observedAt)) return fail('stale_or_unknown_observation');
  if (!object(post) || !id(post.id) || !object(post.question)) return fail('missing_post_question');
  // Official serializer omits these relations when absent. Explicit null is not
  // silently treated as absence. This is a pinned local shape assumption only.
  if (['conditional', 'group_of_questions', 'notebook'].some(k => own(post, k))) return fail('unsupported_content');
  const q = post.question;
  if (!id(q.id) || q.post_id !== post.id || q.type !== 'binary') return fail('unsupported_question_or_mapping');
  if (post.curation_status !== 'approved' || post.status !== 'open' || q.status !== 'open') return fail('not_approved_open');
  const tournaments = post.projects?.tournament;
  if (!Array.isArray(tournaments) || tournaments.length > 100 || tournaments.some(p => !object(p) || !id(p.id) || typeof p.slug !== 'string' || p.type !== 'tournament') || new Set(tournaments.map(p => p.id)).size !== tournaments.length || tournaments.filter(p => p.id === config.roundId && p.slug === config.roundSlug).length !== 1 || tournaments.some(p => p.slug === config.roundSlug && p.id !== config.roundId)) return fail('round_membership_mismatch');
  const dates = ['open_time', 'scheduled_close_time', 'actual_close_time', 'scheduled_resolve_time'];
  if (dates.some(k => !Number.isFinite(time(q[k]))) || !own(q, 'actual_resolve_time') || q.actual_resolve_time !== null || !own(q, 'resolution_set_time') || q.resolution_set_time !== null) return fail('missing_or_resolved_dates');
  const opened = time(q.open_time), scheduled = time(q.scheduled_close_time), effective = time(q.actual_close_time), resolves = time(q.scheduled_resolve_time);
  if (!(opened <= clock && clock < effective && effective <= scheduled && scheduled <= resolves && time(config.roundOpensAt) <= opened && scheduled <= time(config.roundClosesAt))) return fail('invalid_question_window');
  if (!object(q.my_forecasts) || !Array.isArray(q.my_forecasts.history) || q.my_forecasts.history.length !== 0 || !own(q.my_forecasts, 'latest') || q.my_forecasts.latest !== null) return fail('unknown_or_prior_own_forecasts');
  if (!object(history)||history.verifiedEmpty!==true||history.accountId!==config.accountId||history.questionId!==q.id||history.scope!=='complete-api-visible-stored-history'||history.observedAt!==time(config.historyObservedAt))return fail('history_not_verified_empty');
  const fields=['title','description','resolution_criteria','fine_print'];
  if(fields.some(k=>typeof q[k]!=='string')||!q.title.trim()||!q.resolution_criteria.trim())return fail('missing_rule_text');
  const rawRules=Object.fromEntries(fields.map(k=>[k,q[k]]));
  if(Buffer.byteLength(JSON.stringify(rawRules))>3600)return fail('rule_text_limit');
  const sourceUrls=selectSources([q.description,q.resolution_criteria,q.fine_print].join('\n'),config.sourceAllowlist);
  if(!sourceUrls.length)return fail('no_allowlisted_rule_source');
  const criteria={mode:'model-judgment-v2',rawRules,providerDates:Object.fromEntries(dates.map(k=>[k,q[k]]))};
  const signature = createHash('sha256').update(JSON.stringify({ postId: post.id, questionId: q.id, roundId: config.roundId, roundSlug: config.roundSlug, criteria, sourceUrls })).digest('hex');
  return { admitted: true, postId: post.id, questionId: q.id, closesAt: q.actual_close_time, signature, sourceUrls, criteria, semanticsProven:false, liveUseAllowed: false };
}

// Bounded raw public text, not proof of observation freshness or factual adequacy.
// No markup execution, recursive fetch, tool authority, or source-derived credential.
export function parseEvidence(text, criteria, now) {
  if(!object(criteria)||criteria.mode!=='model-judgment-v2'||!Number.isSafeInteger(now)||typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>1200)return evidenceFail('unusable_or_oversized_evidence');
  return {ok:true,observation:{text,publishedAt:null,semanticFreshness:'unknown-model-must-assess'},liveUseAllowed:false};
}
