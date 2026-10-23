import { parseStrictJSON } from './strict-json.mjs';
// Offline policy core. This module performs no I/O and cannot submit forecasts.
import { createHash } from 'node:crypto';
export const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const has = (o, k) => Object.hasOwn(o, k);
const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = v => Number.isSafeInteger(v) && v > 0;
const integer = v => Number.isSafeInteger(v) && v >= 0;
// Canonical UTC instants only: never silently normalize invalid dates or local zones.
export function instant(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)) return null;
  const n = Date.parse(v);
  return Number.isFinite(n) && new Date(n).toISOString() === v ? n : null;
}
function fail(code, path) { throw { gateFailure: true, code, path }; }
function need(o, k, check, path) {
  if (!obj(o) || !has(o, k)) fail('schema_missing', `${path}.${k}`);
  if (!check(o[k])) fail('schema_invalid', `${path}.${k}`);
  return o[k];
}
function eq(o, k, value, path, reason) {
  const v = need(o, k, x => typeof x === typeof value && x !== null, path);
  if (v !== value) fail(reason, `${path}.${k}`);
  return v;
}
function time(o, k, path) { return instant(need(o, k, x => instant(x) !== null, path)); }
function fresh(at, now, maxAge, path) {
  if (at > now || now - at > maxAge) fail('stale_or_future_evidence', path);
}
function windowCheck(start, end, now, path) {
  if (!(start < end)) fail('invalid_time_window', path);
  if (now < start || now >= end) fail('outside_time_window', path);
}
// All names in this envelope are LOCAL contracts, not Metaculus provider fields.
// Candidate evidence is normalized only after a separately reviewed provider adapter.
export function evaluate(serializedInput, expectedProtocolDigest) {
  try {
    if (typeof serializedInput !== 'string') fail('serialized_json_required', '$');
    const input = parseStrictJSON(serializedInput);
    eq(input, 'synthetic', true, '$', 'offline_only');
    const now = time(input, 'now', '$');
    const protocol = need(input, 'protocol', obj, '$');
    eq(protocol, 'synthetic', true, 'protocol', 'offline_only');
    const roundId = need(protocol, 'roundProjectId', id, 'protocol');
    const accountId = need(protocol, 'accountId', id, 'protocol');
    const protocolId = sha256(protocol);
    if (typeof expectedProtocolDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedProtocolDigest)) fail('trusted_protocol_digest_required', 'expectedProtocolDigest');
    if (protocolId !== expectedProtocolDigest) fail('frozen_protocol_mismatch', 'protocol');
    const maxAge = need(protocol, 'maxEvidenceAgeMs', x => integer(x) && x > 0 && x <= 300000, 'protocol');
    const start = time(protocol, 'pilotStartsAt', 'protocol');
    const end = time(protocol, 'pilotEndsAt', 'protocol');
    const roundStart = time(protocol, 'roundOpensAt', 'protocol');
    const roundEnd = time(protocol, 'roundClosesAt', 'protocol');
    windowCheck(start, end, now, 'protocol.pilot');
    windowCheck(roundStart, roundEnd, now, 'protocol.round');
    if (end - start > 14 * 86400000) fail('pilot_window_too_long', 'protocol');
    const snap = need(input, 'snapshot', obj, '$');
    eq(snap, 'protocolDigest', protocolId, 'snapshot', 'protocol_mismatch');
    const observed = time(snap, 'observedAt', 'snapshot');
    fresh(observed, now, maxAge, 'snapshot.observedAt');
    const previous = time(snap, 'previousClockAt', 'snapshot');
    if (previous > observed || previous > now) fail('clock_rollback', 'snapshot.previousClockAt');
    eq(snap, 'roundProjectId', roundId, 'snapshot', 'wrong_round');
    eq(snap, 'roundClosesAt', protocol.roundClosesAt, 'snapshot', 'round_changed');
    eq(snap, 'roundOpensAt', protocol.roundOpensAt, 'snapshot', 'round_changed');
    // Completeness is a transport attestation, never inferred from a short page.
    eq(snap, 'paginationComplete', true, 'snapshot', 'pagination_incomplete');
    eq(snap, 'snapshotConsistent', true, 'snapshot', 'pagination_inconsistent');
    const pages = need(snap, 'pages', x => Array.isArray(x) && x.length > 0, 'snapshot');
    const total = need(snap, 'totalRecords', integer, 'snapshot');
    const posts = new Set(), questions = new Set(), candidates = [];
    let offset = 0;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i], path = `snapshot.pages[${i}]`;
      eq(p, 'offset', offset, path, 'pagination_gap');
      const records = need(p, 'records', Array.isArray, path);
      if (records.length === 0 && (pages.length !== 1 || total !== 0)) fail('empty_intermediate_page', path);
      eq(p, 'terminal', i === pages.length - 1, path, 'pagination_terminal_mismatch');
      for (let j = 0; j < records.length; j++) {
        const r = records[j], rp = `${path}.records[${j}]`;
        const postId = need(r, 'postId', id, rp), questionId = need(r, 'questionId', id, rp);
        // IDs are separate namespaces: numerical equality is valid, inference is not.
        if (posts.has(postId) || questions.has(questionId)) fail('duplicate_record', rp);
        posts.add(postId); questions.add(questionId);
        candidates.push({ r, path: rp });
      }
      offset += records.length;
    }
    if (offset !== total) fail('pagination_count_mismatch', 'snapshot.totalRecords');
    const results = candidates.map(({ r, path }) => {
      try { validateCandidate(r, path, roundId, accountId, now, observed, maxAge); return { postId: r.postId, questionId: r.questionId, eligible: true }; }
      catch (e) { if (!e.gateFailure) throw e; return { postId: r.postId, questionId: r.questionId, eligible: false, code: e.code, path: e.path }; }
    });
    return { synthetic: true, batchValid: true, protocolDigest: protocolId, results, liveUseAllowed: false };
  } catch (e) {
    return { synthetic: true, batchValid: false, results: [], code: e.gateFailure ? e.code : 'malformed_input', path: e.path ?? '$', liveUseAllowed: false };
  }
}
function validateCandidate(r, path, roundId, accountId, now, observed, maxAge) {
  eq(r, 'roundProjectId', roundId, path, 'wrong_round');
  eq(r, 'mappingVerified', true, path, 'mapping_unverified');
  eq(r, 'postQuestionId', r.questionId, path, 'mapping_mismatch');
  eq(r, 'standalone', true, path, 'unsupported_question_structure');
  eq(r, 'type', 'binary', path, 'unsupported_question_type');
  eq(r, 'approved', true, path, 'not_approved');
  eq(r, 'open', true, path, 'not_open');
  eq(r, 'resolved', false, path, 'already_resolved');
  const open = time(r, 'opensAt', path), close = time(r, 'closesAt', path), resolve = time(r, 'resolvesAt', path);
  const scheduledClose = time(r, 'scheduledClosesAt', path), scheduledResolve = time(r, 'scheduledResolvesAt', path);
  windowCheck(open, close, now, path);
  if (resolve < close || scheduledClose < close || scheduledResolve < scheduledClose || resolve > scheduledResolve || now >= scheduledClose || now >= resolve)
    fail('inconsistent_question_dates', path);
  const criteria = need(r, 'criteria', obj, path);
  for (const k of ['description', 'resolutionCriteria', 'finePrint']) need(criteria, k, x => typeof x === 'string', `${path}.criteria`);
  if (!criteria.description.trim() || !criteria.resolutionCriteria.trim()) fail('empty_criteria', `${path}.criteria`);
  const review = need(r, 'criteriaReview', obj, path);
  eq(review, 'method', 'synthetic-rule-v1', `${path}.criteriaReview`, 'criteria_method_unsupported');
  const marker = need(review, 'marker', x => typeof x === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(x), `${path}.criteriaReview`);
  if (criteria.description !== 'Fictional offline event only.' || criteria.finePrint !== '' || criteria.resolutionCriteria !== syntheticCriterion(marker, r.closesAt)) fail('criteria_not_parsed', `${path}.criteria`);
  eq(review, 'criteriaDigest', sha256({ postId: r.postId, questionId: r.questionId, criteria, opensAt: r.opensAt, closesAt: r.closesAt, resolvesAt: r.resolvesAt, scheduledClosesAt: r.scheduledClosesAt, scheduledResolvesAt: r.scheduledResolvesAt }), `${path}.criteriaReview`, 'criteria_changed');
  eq(review, 'complete', true, `${path}.criteriaReview`, 'criteria_incomplete');
  eq(review, 'unambiguous', true, `${path}.criteriaReview`, 'criteria_ambiguous');
  const history = need(r, 'ownHistory', obj, path);
  eq(history, 'accountId', accountId, `${path}.ownHistory`, 'own_history_account_mismatch');
  eq(history, 'complete', true, `${path}.ownHistory`, 'own_history_incomplete');
  const historyAt = time(history, 'observedAt', `${path}.ownHistory`);
  fresh(historyAt, now, maxAge, `${path}.ownHistory.observedAt`);
  if (historyAt < observed) fail('own_history_older_than_snapshot', `${path}.ownHistory`);
  eq(history, 'questionId', r.questionId, `${path}.ownHistory`, 'own_history_question_mismatch');
  eq(history, 'authenticatedAccountVerified', true, `${path}.ownHistory`, 'own_identity_unverified');
  const count = need(history, 'forecastCount', integer, `${path}.ownHistory`);
  if (count !== 0) fail('prior_own_forecast', `${path}.ownHistory.forecastCount`);
}

export function syntheticCriterion(marker, close) { return `At ${close} resolve Yes iff synthetic marker "${marker}" is 1; resolve No iff 0; otherwise abstain. Source: synthetic://fixtures/${marker}.`; }
