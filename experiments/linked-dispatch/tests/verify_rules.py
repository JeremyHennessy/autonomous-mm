#!/usr/bin/env python3
"""Independent finite-state verification; no third-party dependencies or network.
Reference implements the written specification without importing engine.js.
Only engine_probe.cjs executes the production engine for differential comparison.
"""
import collections
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
PLAYING, WON, CRASH = 'playing', 'won', 'crash'


def initial(level):
    return {'p': list(level['start']), 'bits': level.get('bits', 0), 'status': PLAYING, 'reason': ''}


def key(state):
    return (tuple(state['p']), state['bits'], state['status'], state['reason'])


def transition(level, state, action, frozen=None):
    """frozen=(node index, bit value) locally unlinks one gate member."""
    if state['status'] != PLAYING or type(action) is not int or not 0 <= action < level['pairs']:
        return dict(state, p=list(state['p']))
    bits = state['bits'] ^ (2 ** action)
    targets = []
    for position in state['p']:
        if position < 0:
            targets.append(-1)
            continue
        node = level['nodes'][position]
        bit = 0 if node.get('gate') is None else int(bool(bits & (2 ** node['gate'])))
        if frozen is not None and position == frozen[0]:
            bit = frozen[1]
        targets.append(node['out'][bit] if bit < len(node['out']) else None)
    reason = ''
    if None in targets:
        reason = 'End of route'
    elif targets[0] >= 0 and targets[0] == targets[1]:
        reason = 'Same junction collision'
    elif min(state['p']) >= 0 and targets == list(reversed(state['p'])):
        reason = 'Head-on collision'
    elif any(at >= 0 and at == level['goals'][1-i] for i, at in enumerate(targets)):
        reason = 'Wrong depot'
    if reason:
        return {'p': [-2 if at is None else at for at in targets], 'bits': bits, 'status': CRASH, 'reason': reason}
    delivered = [-1 if at == level['goals'][i] else at for i, at in enumerate(targets)]
    return {'p': delivered, 'bits': bits, 'status': WON if delivered == [-1,-1] else PLAYING, 'reason': ''}


def enumerate_states(level, frozen=None):
    start = initial(level)
    states = {key(start): start}
    paths = {key(start): []}
    queue = collections.deque([start])
    while queue:
        state = queue.popleft()
        for action in range(level['pairs']):
            target = transition(level, state, action, frozen)
            k = key(target)
            if k not in states:
                states[k] = target
                paths[k] = paths[key(state)] + [action]
                queue.append(target)
    winners = [paths[k] for k,s in states.items() if s['status'] == WON]
    shortest = min(winners, key=len) if winners else None
    return list(states.values()), paths, shortest


def solo_next(level, position, bits, action, parcel):
    if position == -1:
        return (-1, bits ^ (2 ** action))
    next_bits = bits ^ (2 ** action)
    node = level['nodes'][position]
    edge = 0 if node.get('gate') is None else int(bool(next_bits & (2 ** node['gate'])))
    if edge >= len(node['out']):
        return None
    target = node['out'][edge]
    if target == level['goals'][1-parcel]:
        return None
    return (-1 if target == level['goals'][parcel] else target, next_bits)


def solo_shortest(level, parcel, start=None):
    start = start if start is not None else (level['start'][parcel], level.get('bits',0))
    if start is None:
        return None
    queue = collections.deque([(start,0)])
    seen = {start}
    while queue:
        (position,bits), distance = queue.popleft()
        if position == -1:
            return distance
        for action in range(level['pairs']):
            target = solo_next(level,position,bits,action,parcel)
            if target is not None and target not in seen:
                seen.add(target)
                queue.append((target,distance+1))
    return None


def repeated_win(level, action):
    state = initial(level)
    seen = set()
    while key(state) not in seen:
        seen.add(key(state))
        if state['status'] != PLAYING:
            return state['status'] == WON
        state = transition(level,state,action)
    return False


def distinguish_winning_languages(level, frozen):
    """Exact product-automaton search over all finite action strings.
    Terminal self-loops mean acceptance is 'has reached a win'.
    Returns shortest distinguishing word, or None if equivalent.
    """
    original = initial(level)
    modified = initial(level)
    queue = collections.deque([(original,modified,[])])
    seen = {(key(original),key(modified))}
    while queue:
        left,right,path = queue.popleft()
        if (left['status'] == WON) != (right['status'] == WON):
            return {'actions':path,'originalStatus':left['status'],'frozenStatus':right['status'],'productStatesVisited':len(seen)}
        for action in range(level['pairs']):
            new_left = transition(level,left,action)
            new_right = transition(level,right,action,frozen)
            k = (key(new_left),key(new_right))
            if k not in seen:
                seen.add(k)
                queue.append((new_left,new_right,path+[action]))
    return None


def all_shortest_conflicts(level, states, paths, shortest):
    reverse_edges = collections.defaultdict(list)
    for state in states:
        if state['status'] == PLAYING:
            for action in range(level['pairs']):
                reverse_edges[key(transition(level,state,action))].append(key(state))
    remaining = {key(state):0 for state in states if state['status'] == WON}
    queue = collections.deque(remaining)
    while queue:
        target = queue.popleft()
        for predecessor in reverse_edges[target]:
            if predecessor not in remaining:
                remaining[predecessor] = remaining[target]+1
                queue.append(predecessor)
    witnesses = []
    eligible = 0
    for state in states:
        k = key(state)
        if k not in remaining or len(paths[k])+remaining[k] != len(shortest or []) or state['status'] != PLAYING or min(state['p']) < 0:
            continue
        eligible += 1
        for action in range(level['pairs']):
            targets = [solo_next(level,state['p'][i],state['bits'],action,i) for i in range(2)]
            viable = [t is not None and solo_shortest(level,i,t) is not None for i,t in enumerate(targets)]
            if viable[0] != viable[1]:
                witnesses.append({'state':state,'prefix':paths[k],'conflictingAction':action,'soloViable':viable,'immediateFailure':[t is None for t in targets]})
    return {'eligibleShortestPathStates':eligible,'conflictingChoices':witnesses,'hasConflict':bool(witnesses)}


def coupling(level, index):
    states,paths,shortest = enumerate_states(level)
    individual = [solo_shortest(level,i) for i in range(2)]
    repeated = [repeated_win(level,a) for a in range(level['pairs'])]
    conflicts = []
    state = initial(level)
    for step_index,chosen in enumerate(shortest or []):
        if min(state['p']) >= 0:
            for action in range(level['pairs']):
                targets = [solo_next(level,state['p'][i],state['bits'],action,i) for i in range(2)]
                viable = [t is not None and solo_shortest(level,i,t) is not None for i,t in enumerate(targets)]
                if viable[0] != viable[1]:
                    conflicts.append({'step':step_index,'positions':state['p'],'bits':state['bits'],'chosenAction':chosen,'conflictingAction':action,'soloViable':viable,'immediateFailure':[t is None for t in targets]})
        state = transition(level,state,chosen)
    freezes = []
    original_keys = set(map(key,states))
    for node_index,node in enumerate(level['nodes']):
        if node.get('gate') is not None:
            frozen = (node_index,int(bool(level.get('bits',0) & (2 ** node['gate']))))
            frozen_states,_,frozen_solution = enumerate_states(level,frozen)
            witness = distinguish_winning_languages(level,frozen)
            freezes.append({'node':node_index,'pair':node['gate'],'frozenBit':frozen[1],'reachableSetChanged':set(map(key,frozen_states)) != original_keys,'frozenShortestLength':None if frozen_solution is None else len(frozen_solution),'winningLanguageChanged':witness is not None,'witness':witness})
    return {'candidate':index,'shortestActions':shortest,'jointOptimum':None if shortest is None else len(shortest),'individualOptima':individual,'jointExceedsBothIndividual':shortest is not None and all(v is not None for v in individual) and len(shortest)>max(individual),'repeatedSingleActionWins':repeated,'conflictingChoices':conflicts,'hasConflictingChoice':bool(conflicts),'allShortestSolutionConflictCheck':all_shortest_conflicts(level,states,paths,shortest),'hasImmediateOneParcelFailure':any(any(c['immediateFailure']) for c in conflicts),'frozenMembers':freezes,'anyFrozenMemberChangesWinningLanguage':any(f['winningLanguageChanged'] for f in freezes),'allFrozenMembersChangeWinningLanguage':all(f['winningLanguageChanged'] for f in freezes)}


def load_levels(path):
    raw = json.loads(path.read_text())
    if isinstance(raw,list):
        return raw
    for field in ['levels','selected','boards']:
        if isinstance(raw.get(field),list):
            return raw[field]
    raise ValueError(f'No levels array in {path}')


def verify(levels):
    cases = []
    games = []
    board_counts = []
    invalids = [-1,99,0.5,None,'0',{},[],True,False]
    invariants = collections.Counter()
    for i,level in enumerate(levels):
        states,paths,shortest = enumerate_states(level)
        board_counts.append({'level':level.get('id',i+1),'states':len(states),'statusCounts':dict(collections.Counter(s['status'] for s in states)),'optimalLength':None if shortest is None else len(shortest),'validTransitions':len(states)*level['pairs'],'invalidTransitions':len(states)*(len(invalids)+1)})
        for state in states:
            for action in list(range(level['pairs'])) + invalids + [level['pairs']]:
                expected = transition(level,state,action)
                cases.append({'level':level,'state':state,'action':action,'expected':expected,'board':i+1})
                if expected['status'] == WON:
                    assert expected['p'] == [-1,-1], 'false win'
                    invariants['winsHaveBothDelivered'] += 1
                if state['status'] == PLAYING and type(action) is int and 0 <= action < level['pairs']:
                    for parcel in range(2):
                        if state['p'][parcel] == -1:
                            assert expected['p'][parcel] == -1, 'delivered parcel moved'
                            invariants['deliveredParcelsRemainRemoved'] += 1
                if state['status'] != PLAYING:
                    assert expected == state
                    invariants['terminalStatesUnchanged'] += 1
        if shortest is not None:
            games.append({'level':level,'actions':shortest+[0,0]})
        crash_states = [s for s in states if s['status'] == CRASH]
        if crash_states:
            games.append({'level':level,'actions':paths[key(crash_states[0])]+[0,0]})
        games.append({'level':level,'actions':[None,-1,level['pairs'],0.5,'0',{},[]]})
    payload = {'cases':[{k:v for k,v in c.items() if k not in ('expected','board')} for c in cases],'games':games}
    process = subprocess.run(['node',str(ROOT/'tests/engine_probe.cjs')],input=json.dumps(payload),text=True,capture_output=True,check=True)
    observed = json.loads(process.stdout)
    failures = []
    for case,result in zip(cases,observed['results']):
        if result['output'] != case['expected'] or not result['inputUnchanged'] or not result['detached']:
            failures.append({'board':case['board'],'state':case['state'],'action':case['action'],'expected':case['expected'],'observed':result})
    assert len(observed['results']) == len(cases)
    game_failures = []
    for request,result in zip(games,observed['games']):
        state = initial(request['level'])
        valid_history = []
        expected_states = [state]
        for action in request['actions']:
            if state['status'] == PLAYING and type(action) is int and 0 <= action < request['level']['pairs']:
                valid_history.append(state)
            state = transition(request['level'],state,action)
            expected_states.append(state)
        expected_initial = initial(request['level'])
        checks = {
          'initial': result['initialState']==expected_initial,
          'states': result['states']==expected_states,
          'historyLength': result['historyLength']==len(valid_history),
          'invalidUnchanged': result['invalidUnchanged'],
          'undoStates': result['undoStates']==list(reversed(valid_history)),
          'undoAtStart': result['undoAtStart']==expected_initial,
          'resetState': result['resetState']==expected_initial,
          'resetHistory': result['resetHistory']==0,
          'resetDetached':result['resetDetached']
        }
        if not all(checks.values()):
            game_failures.append({'level':request['level'].get('id'),'actions':request['actions'],'checks':checks,'result':result})
    return {'boards':board_counts,'stateCount':sum(b['states'] for b in board_counts),'comparisonCount':len(cases),'failures':failures,'gameScenarios':len(games),'gameFailures':game_failures,'invariants':dict(invariants)}


def explicit_rule_fixtures():
    # Tiny graphs make toggle timing and each crash/delivery priority observable.
    fixtures = []
    def make(name, outs, start, goals, pairs=1, bits=0, gates=None, state=None, action=0, expected=None):
        gates = gates or {}
        level = {'pairs':pairs,'bits':bits,'start':start,'goals':goals,'nodes':[{'out':edges,'gate':gates.get(i)} for i,edges in enumerate(outs)]}
        fixtures.append({'name':name,'level':level,'state':state or initial(level),'action':action,'expected':expected})
    def result(p,bits,status=PLAYING,reason=''):
        return {'p':p,'bits':bits,'status':status,'reason':reason}
    make('toggle precedes movement', [[2,3],[4],[],[2],[]],[0,1],[2,4],gates={0:0},expected=result([3,-1],1))
    make('both own goals remove and win', [[2],[3],[],[]],[0,1],[2,3],expected=result([-1,-1],1,WON))
    make('same target crashes', [[2],[2],[],[]],[0,1],[2,3],expected=result([2,2],1,CRASH,'Same junction collision'))
    make('head on swap crashes', [[1],[0],[],[]],[0,1],[2,3],expected=result([1,0],1,CRASH,'Head-on collision'))
    make('wrong depot crashes', [[3],[1],[],[]],[0,1],[2,3],expected=result([3,1],1,CRASH,'Wrong depot'))
    make('missing route crashes', [[],[1],[],[]],[0,1],[2,3],expected=result([-2,1],1,CRASH,'End of route'))
    make('delivered parcel stays removed', [[2],[3],[],[]],[-1,1],[2,3],expected=result([-1,-1],1,WON))
    make('swap checked before delivery', [[1],[0]],[0,1],[1,0],expected=result([1,0],1,CRASH,'Head-on collision'))
    make('removed parcel cannot collide', [[2],[3],[],[]],[-1,1],[2,3],expected=result([-1,-1],1,WON))
    make('two physical members toggle together', [[2,3],[3,2],[],[]],[0,1],[2,3],gates={0:0,1:0},expected=result([3,2],1,CRASH,'Wrong depot'))
    make('invalid negative action unchanged', [[2],[3],[],[]],[0,1],[2,3],action=-1,expected=result([0,1],0))
    make('invalid noninteger action unchanged', [[2],[3],[],[]],[0,1],[2,3],action=0.5,expected=result([0,1],0))
    make('terminal win unchanged', [[2],[3],[],[]],[0,1],[2,3],state=result([-1,-1],1,WON),expected=result([-1,-1],1,WON))
    make('terminal crash unchanged', [[2],[3],[],[]],[0,1],[2,3],state=result([2,2],1,CRASH,'Same junction collision'),expected=result([2,2],1,CRASH,'Same junction collision'))
    output = subprocess.run(['node',str(ROOT/'tests/engine_probe.cjs')],input=json.dumps({'cases':[{k:v for k,v in f.items() if k in ('level','state','action')} for f in fixtures],'games':[]}),text=True,capture_output=True,check=True)
    actual = json.loads(output.stdout)['results']
    checks = []
    for fixture, observed in zip(fixtures,actual):
        reference = transition(fixture['level'],fixture['state'],fixture['action'])
        checks.append({'name':fixture['name'],'passed':observed['output']==reference==fixture['expected'],'expected':fixture['expected'],'actual':observed['output']})
    return checks


def main():
    candidates = load_levels(ROOT/'generated.json')
    report = {'scope':'Finite-state engineering checks, not user testing, fun, retention, or revenue evidence.','reference':'Independent Python implementation of the written state transition specification.','actionNotation':'Zero-based linked-pair indices.','couplingDefinition':'At states along one independently found shortest joint solution, an alternative action is conflicting if one parcel retains a solo route to its own goal while the other immediately fails or has no solo winning continuation. Freeze tests fix one physical gate member at its initial bit, leaving the paired member controlled normally. Exact product-automaton exploration distinguishes the full finite winning-word languages.','candidateCoupling':[coupling(l,i+1) for i,l in enumerate(candidates)],'explicitRuleFixtures':explicit_rule_fixtures()}
    final = ROOT/'levels.json'
    if final.exists():
        final_levels = load_levels(final)
        report['finalLevels'] = verify(final_levels)
        third = final_levels[2]
        expected_third_b = transition(third,initial(third),1)
        third_b_output = json.loads(subprocess.run(['node',str(ROOT/'tests/engine_probe.cjs')],input=json.dumps({'cases':[{'level':third,'state':initial(third),'action':1}],'games':[]}),text=True,capture_output=True,check=True).stdout)['results'][0]['output']
        report['tutorialThreeFirstB'] = {'action':1,'reference':expected_third_b,'actual':third_b_output,'passed':expected_third_b==third_b_output and third_b_output['status']==CRASH}
    else:
        report['candidateEngineVerification'] = verify(candidates)
        report['pending'] = 'levels.json not yet present; rerun for final-board verification.'
    report['sourceSha256'] = {name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['engine.js','levels.json','generated.json'] if (ROOT/name).exists()}
    destination = ROOT/'evidence/independent-verification.json'
    destination.write_text(json.dumps(report,indent=2)+'\n')
    section = report.get('finalLevels',report.get('candidateEngineVerification'))
    print(json.dumps({'report':str(destination),'boards':len(section['boards']),'states':section['stateCount'],'comparisons':section['comparisonCount'],'engineFailures':len(section['failures']),'gameScenarios':section['gameScenarios'],'gameFailures':len(section['gameFailures']),'coupling':[{'candidate':c['candidate'],'jointOptimum':c['jointOptimum'],'individualOptima':c['individualOptima'],'noRepeatedWins':not any(c['repeatedSingleActionWins']),'hasConflictingChoice':c['hasConflictingChoice'],'hasImmediateOneParcelFailure':c['hasImmediateOneParcelFailure'],'frozenMembersChangeWinningLanguage':sum(f['winningLanguageChanged'] for f in c['frozenMembers'])} for c in report['candidateCoupling']]},indent=2))
    if section['failures'] or section['gameFailures'] or not all(f['passed'] for f in report['explicitRuleFixtures']) or not report.get('tutorialThreeFirstB',{'passed':True})['passed']:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
