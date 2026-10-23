import { parseStrictJSON } from './strict-json.mjs';
// Pure normalization of source-backed Metaculus fields. No network or eligibility claims.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = v => Number.isSafeInteger(v) && v > 0;
const string = v => typeof v === 'string';
const instantString = v => {
  if (!string(v)) return false;
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(Z|[+-]\d\d:\d\d)$/.exec(v);
  if (!m || !Number.isFinite(Date.parse(v))) return false;
  const [, year, month, day, hour, minute, second] = m;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 &&
    calendar.getUTCFullYear() === Number(year) && calendar.getUTCMonth() + 1 === Number(month) && calendar.getUTCDate() === Number(day) &&
    Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60;
};
const epoch = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const own = (o, k) => Object.hasOwn(o, k);
function field(o, k, valid) {
  if (!object(o) || !own(o, k)) return { state: 'missing' };
  if (o[k] === null) return { state: 'null' };
  if (!valid(o[k])) return { state: 'invalid' };
  return { state: 'value', value: o[k] };
}
function map(obs, fn) { return obs.state === 'value' ? { state: 'value', value: fn(obs.value) } : obs; }
function parsed(serialized, fn) {
  try {
    if (typeof serialized !== 'string') throw Error('JSON required');
    const value = parseStrictJSON(serialized);
    if (!object(value)) throw Error('Object required');
    return { shapeReadable: true, observation: fn(value), eligibilityProven: false, liveUseAllowed: false };
  } catch { return { shapeReadable: false, reason: 'malformed_input', eligibilityProven: false, liveUseAllowed: false }; }
}
function project(p) {
  return { id: field(p, 'id', id), slug: field(p, 'slug', string), type: field(p, 'type', string) };
}
function forecast(f) {
  return { questionId: field(f, 'question_id', id), authorId: field(f, 'author_id', id), startTimeUnix: field(f, 'start_time', epoch), endTimeUnix: field(f, 'end_time', epoch), values: field(f, 'forecast_values', a => Array.isArray(a) && a.length === 2 && a.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1) && Math.abs(a[0] + a[1] - 1) < 1e-12) };
}
function question(q) {
  const out = {
    id: field(q, 'id', id), postId: field(q, 'post_id', id), type: field(q, 'type', string), status: field(q, 'status', string),
    description: field(q, 'description', string), resolutionCriteria: field(q, 'resolution_criteria', string), finePrint: field(q, 'fine_print', string),
  };
  for (const [local, raw] of Object.entries({ openTime: 'open_time', scheduledCloseTime: 'scheduled_close_time', actualCloseTime: 'actual_close_time', scheduledResolveTime: 'scheduled_resolve_time', actualResolveTime: 'actual_resolve_time', resolutionSetTime: 'resolution_set_time' })) out[local] = field(q, raw, instantString);
  out.myForecasts = map(field(q, 'my_forecasts', object), history => ({ history: map(field(history, 'history', Array.isArray), a => a.map(forecast)), latest: map(field(history, 'latest', object), forecast) }));
  return out;
}
function post(p) {
  const out = { id: field(p, 'id', id), curationStatus: field(p, 'curation_status', string), status: field(p, 'status', string), question: map(field(p, 'question', object), question) };
  out.otherContent = { conditional: field(p, 'conditional', object), groupOfQuestions: field(p, 'group_of_questions', object), notebook: field(p, 'notebook', object) };
  out.projects = map(field(p, 'projects', object), projects => ({ tournament: map(field(projects, 'tournament', Array.isArray), a => a.map(project)), defaultProject: map(field(projects, 'default_project', object), project) }));
  // Observations only: no standalone, approved/open, unresolved, history-complete,
  // authenticated identity, freshness, criteria-clear, or round proof is invented.
  return out;
}
export function normalizePost(serialized) { return parsed(serialized, post); }
export function normalizePage(serialized) {
  return parsed(serialized, p => ({ next: field(p, 'next', string), previous: field(p, 'previous', string), results: map(field(p, 'results', Array.isArray), a => a.map(post)), snapshotConsistency: 'unknown', completeEnumeration: 'unknown' }));
}
export function normalizeOwnForecastRead(serialized) {
  return parsed(serialized, response => ({ results: map(field(response, 'results', Array.isArray), a => a.map(r => ({ questionId: field(r, 'question_id', id), forecasts: map(field(r, 'forecasts', Array.isArray), fs => fs.map(forecast)) }))), authenticatedIdentity: 'unknown', completeHistory: 'unknown' }));
}
