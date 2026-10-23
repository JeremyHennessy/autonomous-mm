import { createHash } from 'node:crypto';
import { parseStrictJSON } from './deps/strict-json.mjs';

// DISABLED candidate, tested only with synthetic fixtures. Local trust assertions, not provider
// response fields. No claim that this tiny grammar covers real MiniBench questions.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = v => Number.isSafeInteger(v) && v > 0;
const own = (o, k) => Object.hasOwn(o, k);
const fail = reason => ({ admitted: false, reason, liveUseAllowed: false });
const evidenceFail = reason => ({ ok: false, reason });
export const DESCRIPTION = 'Resolve using only the linked machine-readable source.';
export const FINE_PRINT = 'Missing or conflicting source data means abstain.';
const MAX_JSON_BYTES = 65536;
function json(value) {
  // Objects are a convenience for trusted synthetic fixture builders only. Raw
  // external input must stay serialized so duplicate keys cannot be erased.
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_JSON_BYTES) throw Error('size');
  return parseStrictJSON(text);
}
function time(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)) return NaN;
  const n = Date.parse(v);
  return Number.isFinite(n) && new Date(n).toISOString() === v ? n : NaN;
}
function httpsUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password && !u.hash && u.port === '' && u.href === s;
  } catch { return false; }
}
const exactKeys = (v, keys) => object(v) && Object.keys(v).length === keys.length && keys.every(k => own(v, k));
const fresh = (stamp, now, age) => Number.isFinite(time(stamp)) && time(stamp) <= now && now - time(stamp) <= age;

export function parseCriteria(question) {
  if (!object(question) || question.description !== DESCRIPTION || question.fine_print !== FINE_PRINT || typeof question.resolution_criteria !== 'string' || question.resolution_criteria.length > 4096) return null;
  const text = question.resolution_criteria;
  const metric = /^Resolves Yes if metric "([A-Za-z][A-Za-z0-9_-]{0,63})" in unit "([A-Za-z][A-Za-z0-9_-]{0,31})" is (>=|>|<=|<) (-?(?:0|[1-9]\d*)(?:\.\d+)?) at (\S+), otherwise No\. Source: (https:\/\/\S+)$/.exec(text);
  const event = /^Resolves Yes if event "([A-Za-z][A-Za-z0-9_-]{0,63})" has occurred by (\S+), otherwise No\. Source: (https:\/\/\S+)$/.exec(text);
  let criteria;
  if (metric) criteria = { grammar: 'narrow-observation-v1', kind: 'threshold', name: metric[1], unit: metric[2], operator: metric[3], threshold: Number(metric[4]), targetTime: metric[5], sourceUrl: metric[6] };
  else if (event) criteria = { grammar: 'narrow-observation-v1', kind: 'event', name: event[1], targetTime: event[2], sourceUrl: event[3] };
  else return null;
  if (!Number.isFinite(time(criteria.targetTime)) || !httpsUrl(criteria.sourceUrl) || (criteria.kind === 'threshold' && !Number.isFinite(criteria.threshold))) return null;
  return criteria;
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
  if (config.historyComplete !== true || config.historyAccountId !== config.accountId || !object(history) || !Array.isArray(history.results) || history.results.length !== 1 || !exactKeys(history.results[0], ['question_id', 'forecasts']) || history.results[0].question_id !== q.id || !Array.isArray(history.results[0].forecasts) || history.results[0].forecasts.length !== 0) return fail('history_not_verified_empty');
  const criteria = parseCriteria(q);
  if (!criteria || time(criteria.targetTime) !== scheduled) return fail('unsupported_or_conflicting_criteria');
  const signature = createHash('sha256').update(JSON.stringify({ postId: post.id, questionId: q.id, roundId: config.roundId, roundSlug: config.roundSlug, dates: dates.map(k => q[k]), criteria, description: q.description, finePrint: q.fine_print })).digest('hex');
  return { admitted: true, postId: post.id, questionId: q.id, closesAt: q.actual_close_time, signature, sourceUrls: [criteria.sourceUrl], criteria, liveUseAllowed: false };
}

// Evidence is a bounded JSON observation, never an oracle probability. A true
// event observation is not necessarily a final resolution; false is not proof
// that an event cannot occur before the future target. No natural-language or
// arbitrary HTML interpretation is supported. Source authenticity is unproved.
export function parseEvidence(text, criteria, now) {
  const clock = typeof now === 'number' ? now : time(now);
  if (!object(criteria) || criteria.grammar !== 'narrow-observation-v1' || !['threshold', 'event'].includes(criteria.kind) || !Number.isFinite(clock) || !Number.isFinite(time(criteria.targetTime)) || !httpsUrl(criteria.sourceUrl)) return evidenceFail('invalid_criteria_or_clock');
  let data;
  try { if (typeof text !== 'string') throw Error(); data = json(text); } catch { return evidenceFail('malformed_evidence'); }
  const keys = criteria.kind === 'threshold' ? ['source_url', 'metric', 'unit', 'value', 'observed_at'] : ['source_url', 'event', 'occurred', 'observed_at'];
  if (!exactKeys(data, keys) || data.source_url !== criteria.sourceUrl || !fresh(data.observed_at, clock, 300000) || time(data.observed_at) > time(criteria.targetTime)) return evidenceFail('missing_conflicting_or_stale_evidence');
  if (criteria.kind === 'threshold' && (data.metric !== criteria.name || data.unit !== criteria.unit || typeof data.value !== 'number' || !Number.isFinite(data.value))) return evidenceFail('invalid_metric_observation');
  if (criteria.kind === 'event' && (data.event !== criteria.name || typeof data.occurred !== 'boolean')) return evidenceFail('invalid_event_observation');
  return { ok: true, observation: { kind: criteria.kind, name: criteria.name, ...(criteria.kind === 'threshold' ? { value: data.value, unit: data.unit } : { occurred: data.occurred }), observedAt: data.observed_at, sourceUrl: data.source_url }, liveUseAllowed: false };
}
