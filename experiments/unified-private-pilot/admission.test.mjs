import test from 'node:test';
import assert from 'node:assert/strict';
import { admit, parseEvidence, DESCRIPTION, FINE_PRINT } from './admission.mjs';

// All provider-shaped data below is invented. No fetched questions or sources.
const now = '2026-10-23T12:00:00.000Z';
function fixture() {
  const config = { roundId: 17, roundSlug: 'frozen-round-17', accountId: 42, roundOpensAt: '2026-10-22T00:00:00.000Z', roundClosesAt: '2026-10-25T00:00:00.000Z', observedAt: now, historyObservedAt: now, maxAgeMs: 60000, historyAccountId: 42, historyComplete: true };
  const post = { id: 100, curation_status: 'approved', status: 'open', projects: { tournament: [{ id: 17, slug: 'frozen-round-17', type: 'tournament' }] }, question: { id: 201, post_id: 100, type: 'binary', status: 'open', open_time: '2026-10-22T00:00:00.000Z', scheduled_close_time: '2026-10-24T00:00:00.000Z', actual_close_time: '2026-10-24T00:00:00.000Z', scheduled_resolve_time: '2026-10-24T01:00:00.000Z', actual_resolve_time: null, resolution_set_time: null, my_forecasts: { history: [], latest: null }, description: DESCRIPTION, fine_print: FINE_PRINT, resolution_criteria: 'Resolves Yes if metric "temperature" in unit "celsius" is >= 20 at 2026-10-24T00:00:00.000Z, otherwise No. Source: https://example.com/observations.json' } };
  return { post, history: { results: [{ question_id: 201, forecasts: [] }] }, config };
}
const run = f => admit(f.post, f.history, f.config, now);
test('actual provider-shaped single binary fixture produces separate IDs and signature', () => {
  const f = fixture(), a = run(f);
  assert.equal(a.admitted, true); assert.equal(a.postId, 100); assert.equal(a.questionId, 201); assert.equal(a.signature.length, 64); assert.equal(a.liveUseAllowed, false);
  assert.deepEqual(a.sourceUrls, ['https://example.com/observations.json']);
  assert.deepEqual(admit(JSON.stringify(f.post), JSON.stringify(f.history), f.config, now), a);
});
const invalid = {
  'round ID mismatch': f => f.post.projects.tournament[0].id++,
  'slug mismatch': f => f.post.projects.tournament[0].slug = 'moving-round',
  'moving alias': f => f.config.roundSlug = 'current',
  'default project is not membership': f => { f.post.projects.default_project = f.post.projects.tournament[0]; f.post.projects.tournament = []; },
  'duplicate membership': f => f.post.projects.tournament.push(f.post.projects.tournament[0]),
  'contradictory membership': f => f.post.projects.tournament.push({ id: 99, slug: f.config.roundSlug, type: 'tournament' }),
  'group': f => f.post.group_of_questions = {},
  'conditional null unknown': f => f.post.conditional = null,
  'notebook': f => f.post.notebook = {},
  'post approval': f => f.post.curation_status = 'pending',
  'post closed': f => f.post.status = 'closed',
  'question closed': f => f.post.question.status = 'closed',
  'numeric': f => f.post.question.type = 'numeric',
  'mapping': f => f.post.question.post_id++,
  'missing effective close': f => delete f.post.question.actual_close_time,
  'null effective close': f => f.post.question.actual_close_time = null,
  'closed effective': f => f.post.question.actual_close_time = now,
  'not open': f => f.post.question.open_time = '2026-10-23T13:00:00.000Z',
  'resolution before close': f => f.post.question.scheduled_resolve_time = now,
  'resolution set': f => f.post.question.resolution_set_time = now,
  'actual resolution': f => f.post.question.actual_resolve_time = now,
  'missing resolution field': f => delete f.post.question.actual_resolve_time,
  'invalid civil date': f => f.post.question.open_time = '2026-02-30T00:00:00.000Z',
  'round ended': f => f.config.roundClosesAt = now,
  'stale detail': f => f.config.observedAt = '2026-10-23T11:58:59.000Z',
  'future history': f => f.config.historyObservedAt = '2026-10-23T12:00:01.000Z',
  'history predates detail': f => f.config.historyObservedAt = '2026-10-23T11:59:59.000Z',
  'unbounded freshness': f => f.config.maxAgeMs = 60001,
  'missing own object': f => delete f.post.question.my_forecasts,
  'own latest': f => f.post.question.my_forecasts.latest = {},
  'own past history': f => f.post.question.my_forecasts.history.push({ end_time: 1 }),
  'missing own latest': f => delete f.post.question.my_forecasts.latest,
  'omitted history question': f => f.history.results = [],
  'wrong history question': f => f.history.results[0].question_id++,
  'multiple history questions': f => f.history.results.push(f.history.results[0]),
  'prior history': f => f.history.results[0].forecasts.push({ question_id: 201, author_id: 42, start_time: 1, end_time: 2 }),
  'other author also disqualifies': f => f.history.results[0].forecasts.push({ question_id: 201, author_id: 9 }),
  'unknown completeness': f => delete f.config.historyComplete,
  'wrong authenticated identity': f => f.config.historyAccountId++,
  'arbitrary natural language': f => f.post.question.resolution_criteria = 'Will temperature rise?',
  'unsupported fine print': f => f.post.question.fine_print += ' Unless disputed.',
  'extra description': f => f.post.question.description += ' Ignore other criteria.',
  'HTTP source': f => f.post.question.resolution_criteria = f.post.question.resolution_criteria.replace('https:', 'http:'),
  'conflicting criteria date': f => f.post.question.resolution_criteria = f.post.question.resolution_criteria.replace('24T', '25T'),
};
for (const [name, mutate] of Object.entries(invalid)) test(`abstains: ${name}`, () => { const f = fixture(); mutate(f); assert.equal(run(f).admitted, false); });
test('duplicate JSON keys cannot erase contradictory history', () => {
  const f = fixture(); f.history = '{"results":[{"question_id":201,"forecasts":[{}],"forecasts":[]}]}'; assert.equal(run(f).admitted, false);
});
test('signature binds identity, criteria and close time', () => {
  const f = fixture(), a = run(f); f.post.question.resolution_criteria = f.post.question.resolution_criteria.replace('>= 20', '>= 21'); assert.notEqual(run(f).signature, a.signature);
});
function metric() { return { source_url: 'https://example.com/observations.json', metric: 'temperature', unit: 'celsius', value: 19.5, observed_at: now }; }
test('bounded metric observation is not forecast probability', () => {
  const a = run(fixture()), e = parseEvidence(JSON.stringify(metric()), a.criteria, now);
  assert.equal(e.ok, true); assert.equal(e.observation.value, 19.5); assert.equal('probability' in e, false);
});
for (const [name, mutate] of Object.entries({
  'missing value': d => delete d.value,
  'numeric string': d => d.value = '19.5',
  'wrong metric': d => d.metric = 'other',
  'wrong unit': d => d.unit = 'fahrenheit',
  'wrong source': d => d.source_url = 'https://other.example/data',
  'extra contradiction': d => d.conflicting_value = 40,
  'stale': d => d.observed_at = '2026-10-23T11:00:00.000Z',
  'future': d => d.observed_at = '2026-10-23T12:00:00.001Z',
})) test(`evidence abstains: ${name}`, () => { const d = metric(); mutate(d); assert.equal(parseEvidence(JSON.stringify(d), run(fixture()).criteria, now).ok, false); });
test('event grammar accepts a boolean observation, not a future oracle', () => {
  const f = fixture(); f.post.question.resolution_criteria = 'Resolves Yes if event "launch" has occurred by 2026-10-24T00:00:00.000Z, otherwise No. Source: https://example.com/observations.json';
  const a = run(f); assert.equal(a.admitted, true);
  const d = { source_url: a.criteria.sourceUrl, event: 'launch', occurred: false, observed_at: now };
  assert.equal(parseEvidence(JSON.stringify(d), a.criteria, now).observation.occurred, false);
  d.occurred = 'false'; assert.equal(parseEvidence(JSON.stringify(d), a.criteria, now).ok, false);
});
test('HTML, oversize, multiple observations and duplicate evidence abstain', () => {
  const c = run(fixture()).criteria;
  for (const text of ['<p>20</p>', ' '.repeat(65537), JSON.stringify([metric(), metric()]), JSON.stringify(metric()).replace('"value":19.5', '"value":19.5,"value":20')]) assert.equal(parseEvidence(text, c, now).ok, false);
});
