import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, instant, sha256, syntheticCriterion } from './gate.mjs';
export function fixture() {
  const protocol = { synthetic: true, roundProjectId: 777, accountId: 888, pilotStartsAt: '2026-10-23T00:00:00.000Z', pilotEndsAt: '2026-11-05T00:00:00.000Z', roundOpensAt: '2026-10-23T00:00:00.000Z', roundClosesAt: '2026-10-29T00:00:00.000Z', maxEvidenceAgeMs: 60000 };
  const r = { postId: 101, questionId: 202, postQuestionId: 202, roundProjectId: 777, mappingVerified: true, standalone: true, type: 'binary', approved: true, open: true, resolved: false,
    opensAt: '2026-10-23T00:00:00.000Z', closesAt: '2026-10-28T00:00:00.000Z', resolvesAt: '2026-10-29T00:00:00.000Z', scheduledClosesAt: '2026-10-28T00:00:00.000Z', scheduledResolvesAt: '2026-10-29T00:00:00.000Z',
    criteria: { description: 'Fictional offline event only.', resolutionCriteria: syntheticCriterion('example', '2026-10-28T00:00:00.000Z'), finePrint: '' },
    criteriaReview: { method: 'synthetic-rule-v1', marker: 'example', complete: true, unambiguous: true }, ownHistory: { accountId: 888, questionId: 202, authenticatedAccountVerified: true, complete: true, forecastCount: 0, observedAt: '2026-10-23T12:00:00.000Z' } };
  bind(r);
  return { synthetic: true, now: '2026-10-23T12:00:00.000Z', protocol, snapshot: { protocolDigest: sha256(protocol), observedAt: '2026-10-23T12:00:00.000Z', previousClockAt: '2026-10-23T11:59:00.000Z', roundProjectId: 777, roundOpensAt: protocol.roundOpensAt, roundClosesAt: protocol.roundClosesAt, paginationComplete: true, snapshotConsistent: true, totalRecords: 1, pages: [{ offset: 0, terminal: true, records: [r] }] } };
}
const rec = f => f.snapshot.pages[0].records[0];
function bind(r) { r.criteriaReview.criteriaDigest = sha256({ postId: r.postId, questionId: r.questionId, criteria: r.criteria, opensAt: r.opensAt, closesAt: r.closesAt, resolvesAt: r.resolvesAt, scheduledClosesAt: r.scheduledClosesAt, scheduledResolvesAt: r.scheduledResolvesAt }); }
const EXPECTED_PROTOCOL_DIGEST = sha256(fixture().protocol);
const run = f => evaluate(JSON.stringify(f), EXPECTED_PROTOCOL_DIGEST);
const eligible = f => { const v = run(f); assert.equal(v.batchValid, true); assert.equal(v.results[0].eligible, true); assert.equal(v.liveUseAllowed, false); };
function reject(name, mutate, code, batch = false) { test(name, () => { const f = fixture(); mutate(f, rec(f)); const out = run(f); const result = batch ? out : out.results[0]; assert.equal(batch ? out.batchValid : result.eligible, false); assert.equal(result.code, code); assert.equal(out.liveUseAllowed, false); if (batch) assert.deepEqual(out.results, []); }); }
test('fictional candidate only passes synthetic local policy', () => eligible(fixture()));
test('separate namespaces allow equal numerical IDs', () => { const f = fixture(), r = rec(f); r.postId = r.questionId; bind(r); eligible(f); });
test('complete two-page input works', () => { const f = fixture(), r = structuredClone(rec(f)); r.postId = 102; r.questionId = r.postQuestionId = r.ownHistory.questionId = 203; bind(r); f.snapshot.pages[0].terminal = false; f.snapshot.pages.push({ offset: 1, terminal: true, records: [r] }); f.snapshot.totalRecords = 2; assert.equal(run(f).results.filter(r => r.eligible).length, 2); });
reject('live input prohibited', f => f.synthetic = false, 'offline_only', true);
reject('moving round alias prohibited', f => f.protocol.roundProjectId = 'minibench-current', 'schema_invalid', true);
reject('snapshot wrong exact round', f => f.snapshot.roundProjectId++, 'wrong_round', true);
reject('round end cannot drift', f => f.snapshot.roundClosesAt = f.protocol.pilotEndsAt, 'round_changed', true);
reject('protocol mutation breaks binding', f => f.protocol.maxEvidenceAgeMs++, 'frozen_protocol_mismatch', true);
reject('missing pagination differs from false', f => delete f.snapshot.paginationComplete, 'schema_missing', true);
reject('incomplete pagination', f => f.snapshot.paginationComplete = false, 'pagination_incomplete', true);
reject('inconsistent snapshot', f => f.snapshot.snapshotConsistent = false, 'pagination_inconsistent', true);
reject('pagination skipped offset', f => f.snapshot.pages[0].offset = 2, 'pagination_gap', true);
reject('pagination count mismatch', f => f.snapshot.totalRecords = 2, 'pagination_count_mismatch', true);
reject('missing terminal page', f => f.snapshot.pages[0].terminal = false, 'pagination_terminal_mismatch', true);
reject('duplicate post across pages', (f,r) => { f.snapshot.pages[0].terminal = false; f.snapshot.pages.push({ offset: 1, terminal: true, records: [structuredClone(r)] }); f.snapshot.totalRecords = 2; }, 'duplicate_record', true);
reject('question repeated under different post', (f,r) => { const other = structuredClone(r); other.postId++; f.snapshot.pages[0].records.push(other); f.snapshot.totalRecords = 2; }, 'duplicate_record', true);
reject('future snapshot', f => f.snapshot.observedAt = '2026-10-23T12:00:01.000Z', 'stale_or_future_evidence', true);
reject('stale snapshot', f => f.now = '2026-10-23T12:02:00.000Z', 'stale_or_future_evidence', true);
reject('clock rollback', f => f.snapshot.previousClockAt = '2026-10-23T12:00:01.000Z', 'clock_rollback', true);
reject('exclusive round end', f => f.now = f.protocol.roundClosesAt, 'outside_time_window', true);
reject('invalid clock', f => f.now = 'NaN', 'schema_invalid', true);
reject('missing ID', (_,r) => delete r.questionId, 'schema_missing', true);
reject('no implicit mapping', (_,r) => delete r.postQuestionId, 'schema_missing');
reject('swapped question mapping', (_,r) => r.postQuestionId = r.postId, 'mapping_mismatch');
reject('wrong candidate round', (_,r) => r.roundProjectId++, 'wrong_round');
reject('groups or conditionals unsupported', (_,r) => r.standalone = false, 'unsupported_question_structure');
reject('nonbinary unsupported', (_,r) => r.type = 'numeric', 'unsupported_question_type');
reject('unapproved false is not schema missing', (_,r) => r.approved = false, 'not_approved');
reject('approval missing', (_,r) => delete r.approved, 'schema_missing');
reject('approval null', (_,r) => r.approved = null, 'schema_invalid');
reject('approval truthy string rejected', (_,r) => r.approved = 'true', 'schema_invalid');
reject('not open', (_,r) => r.open = false, 'not_open');
reject('already resolved', (_,r) => r.resolved = true, 'already_resolved');
reject('question opens in future', (_,r) => r.opensAt = '2026-10-24T00:00:00.000Z', 'outside_time_window');
reject('question close exclusive', (_,r) => r.closesAt = '2026-10-23T12:00:00.000Z', 'outside_time_window');
reject('resolution before close', (_,r) => r.resolvesAt = '2026-10-27T00:00:00.000Z', 'inconsistent_question_dates');
reject('scheduled date missing', (_,r) => delete r.scheduledResolvesAt, 'schema_missing');
reject('blank criteria', (_,r) => r.criteria.resolutionCriteria = ' ', 'empty_criteria');
reject('criteria modified after review', (_,r) => r.criteria.finePrint = 'Changed.', 'criteria_not_parsed');
reject('date modified after review', (_,r) => r.resolvesAt = '2026-10-28T12:00:00.000Z', 'criteria_changed');
reject('criteria ambiguity', (_,r) => r.criteriaReview.unambiguous = false, 'criteria_ambiguous');
reject('criteria incomplete', (_,r) => r.criteriaReview.complete = false, 'criteria_incomplete');
reject('own history absent', (_,r) => delete r.ownHistory, 'schema_missing');
reject('own forecast exists', (_,r) => r.ownHistory.forecastCount = 1, 'prior_own_forecast');
reject('history count missing is not zero', (_,r) => delete r.ownHistory.forecastCount, 'schema_missing');
reject('history null is not zero', (_,r) => r.ownHistory.forecastCount = null, 'schema_invalid');
reject('history incomplete', (_,r) => r.ownHistory.complete = false, 'own_history_incomplete');
reject('own identity unknown', (_,r) => r.ownHistory.authenticatedAccountVerified = false, 'own_identity_unverified');
reject('wrong history question', (_,r) => r.ownHistory.questionId++, 'own_history_question_mismatch');
reject('history before snapshot', (_,r) => r.ownHistory.observedAt = '2026-10-23T11:59:59.000Z', 'own_history_older_than_snapshot');
test('empty complete batch returns no candidates', () => { const f = fixture(); f.snapshot.pages[0].records = []; f.snapshot.totalRecords = 0; assert.deepEqual(run(f).results, []); assert.equal(run(f).batchValid, true); });
test('malformed serializations fail closed', () => { for (const v of [null, {}, '{', 'null', '[]']) assert.equal(evaluate(v).batchValid, false); });
test('canonical finite clocks reject invalid civil dates and implicit zones', () => { for (const v of [null, NaN, Infinity, 0, '2026-02-30T00:00:00.000Z', '2026-10-23', '2026-10-23T12:00:00Z', '2026-10-23T12:00:00.000+00:00']) assert.equal(instant(v), null); });

reject('own account mismatch', (_,r) => r.ownHistory.accountId++, 'own_history_account_mismatch');
reject('arbitrary criteria assertion cannot pass parser', (_,r) => { r.criteria.resolutionCriteria = 'Unknown event.'; bind(r); }, 'criteria_not_parsed');
reject('unknown criteria method rejected', (_,r) => r.criteriaReview.method = 'trusted', 'criteria_method_unsupported');

reject('jointly rewritten round and self-consistent digest cannot change frozen trust anchor', (f,r) => { f.protocol.roundProjectId++; f.snapshot.roundProjectId++; r.roundProjectId++; f.snapshot.protocolDigest = sha256(f.protocol); }, 'frozen_protocol_mismatch', true);
test('caller must supply separate frozen protocol anchor', () => assert.equal(evaluate(JSON.stringify(fixture())).code, 'trusted_protocol_digest_required'));

test('duplicate local evidence keys fail closed', () => assert.equal(evaluate('{"synthetic":false,"synthetic":true}', EXPECTED_PROTOCOL_DIGEST).code, 'malformed_input'));
