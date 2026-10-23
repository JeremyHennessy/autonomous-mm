// Parse JSON without silently accepting last-key-wins contradictory evidence.
export function parseStrictJSON(text) {
  if (typeof text !== 'string') throw new TypeError('Serialized JSON required');
  const parsed = JSON.parse(text); // Establish valid JSON syntax before token scanning.
  const stack = [];
  const tokens = /"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;
  for (const match of text.matchAll(tokens)) {
    const token = match[0], parent = stack.at(-1);
    if (token === '{') stack.push({ object: true, key: true, keys: new Set() });
    else if (token === '[') stack.push({ object: false });
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && parent?.object) parent.key = true;
    else if (token[0] === '"' && parent?.object && parent.key) {
      const key = JSON.parse(token);
      if (parent.keys.has(key)) throw new SyntaxError('Duplicate object key');
      parent.keys.add(key);
      parent.key = false;
    }
  }
  return parsed;
}
