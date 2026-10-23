// Batch adapter only. Rule logic lives independently in Python.
const fs = require('fs');
const {initial, step, Game} = require('../engine.js');
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
const results = request.cases.map(({level, state, action}) => {
  const before = JSON.stringify(state);
  const output = step(level, state, action);
  const outputBefore = JSON.stringify(output);
  if (output.p.length) output.p[0] = 999;
  const detached = JSON.stringify(state) === before;
  return {output: JSON.parse(outputBefore), inputUnchanged: JSON.stringify(state) === before, detached};
});
const games = request.games.map(({level, actions}) => {
  const game = new Game(level);
  const initialState = structuredClone(game.state);
  const states = [structuredClone(game.state)];
  for (const action of actions) { game.move(action); states.push(structuredClone(game.state)); }
  const historyLength = game.history.length;
  const invalidBefore = JSON.stringify({state:game.state,history:game.history});
  for (const action of [-1,level.pairs,0.5,null,'0',{},[]]) game.move(action);
  const invalidUnchanged = JSON.stringify({state:game.state,history:game.history}) === invalidBefore;
  const undoStates = [];
  while (game.history.length) { game.undo(); undoStates.push(structuredClone(game.state)); }
  game.undo();
  const undoAtStart = structuredClone(game.state);
  for (const action of actions) game.move(action);
  game.reset();
  const resetState = structuredClone(game.state);
  const resetHistory = game.history.length;
  // initial() and reset must not alias the level's start positions.
  game.state.p[0] = 999;
  const resetDetached = level.start[0] !== 999;
  return {initialState,states,historyLength,invalidUnchanged,undoStates,undoAtStart,resetState,resetHistory,resetDetached};
});
process.stdout.write(JSON.stringify({results,games}));
