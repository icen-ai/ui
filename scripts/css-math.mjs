/** Resolve the scalar CSS math used by exported seeds. Unknown syntax fails closed. */
export function resolveCssMath(source, variables = new Map(), seen = new Set()) {
  if (seen.size > 40 || source.length > 4096) return null;
  let cursor = 0;
  const space = () => { while (/\s/.test(source[cursor] || '') && cursor < source.length) cursor++; };
  const take = text => { space(); if (!source.startsWith(text, cursor)) return false; cursor += text.length; return true; };
  const fail = () => { throw Error('Unsupported scalar expression'); };
  function primary() {
    space();
    if (take('-')) { const value = primary(); return { ...value, number: -value.number }; }
    if (take('+')) return primary();
    const rest = source.slice(cursor);
    const ref = rest.match(/^var\(\s*(--[\w-]+)\s*\)/);
    if (ref) {
      cursor += ref[0].length; const name = ref[1];
      if (seen.has(name) || !variables.has(name)) return fail();
      const value = resolveCssMath(variables.get(name), variables, new Set([...seen, name]));
      return value ?? fail();
    }
    const fn = rest.match(/^(calc|min|max|clamp)\(/);
    if (fn) {
      cursor += fn[0].length;
      const args = [sum()]; while (take(',')) args.push(sum());
      if (!take(')') || args.some(v => v.unit !== args[0].unit)) return fail();
      if (fn[1] === 'calc') { if (args.length !== 1) return fail(); return args[0]; }
      if (fn[1] === 'clamp' && args.length !== 3) return fail();
      const values = args.map(v => v.number);
      return { number: fn[1] === 'min' ? Math.min(...values) : fn[1] === 'max' ? Math.max(...values) : Math.max(values[0], Math.min(values[1], values[2])), unit: args[0].unit };
    }
    if (take('(')) { const value = sum(); if (!take(')')) return fail(); return value; }
    const number = rest.match(/^(\d+(?:\.\d*)?|\.\d+)(px|rem|ms|s)?/);
    if (!number) return fail();
    cursor += number[0].length;
    return { number: Number(number[1]) * (number[2] === 's' ? 1000 : 1), unit: number[2] === 's' ? 'ms' : number[2] || '' };
  }
  function product() {
    let left = primary();
    while (true) {
      if (take('*')) {
        const right = primary(); if (left.unit && right.unit) return fail();
        left = { number: left.number * right.number, unit: left.unit || right.unit };
      } else if (take('/')) {
        const right = primary(); if (right.unit || right.number === 0) return fail();
        left = { number: left.number / right.number, unit: left.unit };
      } else return left;
    }
  }
  function sum() {
    let left = product();
    while (true) {
      let sign;
      if (take('+')) sign = 1; else if (take('-')) sign = -1; else return left;
      const right = product(); if (left.unit !== right.unit) return fail();
      left = { number: left.number + sign * right.number, unit: left.unit };
    }
  }
  try { const value = sum(); space(); return cursor === source.length && Number.isFinite(value.number) ? value : null; }
  catch { return null; }
}
