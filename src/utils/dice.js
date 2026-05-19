export const DIE_SIDES = [2, 4, 6, 8, 10, 12, 20, 100];

let lastSeq = 0;

export function rollDie(sides) {
  // Math.random is fine for tabletop fairness — these aren't crypto rolls.
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < Math.max(1, Math.min(20, count)); i++) {
    rolls.push(rollDie(sides));
  }
  return rolls;
}

export function rollTest({ modifier = 0, dr = 12, label = '' } = {}) {
  const die = rollDie(20);
  const total = die + modifier;
  const crit = die === 20;
  const fumble = die === 1;
  const success = crit || (!fumble && total >= dr);
  return {
    kind: 'test',
    label,
    die,
    modifier,
    dr,
    total,
    success,
    crit,
    fumble,
    text: formatTestText({ die, modifier, dr, total, success, crit, fumble }),
    id: ++lastSeq,
    at: Date.now(),
  };
}

export function rollDamage({ count = 1, sides = 6, modifier = 0, label = '' } = {}) {
  const rolls = rollDice(count, sides);
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return {
    kind: 'damage',
    label,
    count,
    sides,
    modifier,
    rolls,
    total,
    text: `${count}d${sides}${modifier ? signed(modifier) : ''} = [${rolls.join(', ')}]${modifier ? signed(modifier) : ''} → ${total}`,
    id: ++lastSeq,
    at: Date.now(),
  };
}

// Parse and roll a simple dice expression. Supports:
//   d6        → 1d6
//   3d6       → 3d6 summed
//   3d6+1     → with flat modifier
//   3d6-2
//   1d6*10    → multiply final sum
//   12        → constant
// Returns a number. Unknown formats fall back to 0.
export function rollExpr(expr) {
  if (typeof expr === 'number') return expr;
  if (typeof expr !== 'string') return 0;
  const trimmed = expr.trim();
  // Plain integer.
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const m = trimmed.match(/^(\d*)d(\d+)([+\-*]\d+)?$/i);
  if (!m) return 0;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  let total = 0;
  for (let i = 0; i < count; i++) total += rollDie(sides);
  if (m[3]) {
    const op = m[3][0];
    const n = parseInt(m[3].slice(1), 10);
    if (op === '+') total += n;
    else if (op === '-') total -= n;
    else if (op === '*') total *= n;
  }
  return total;
}

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function formatTestText({ die, modifier, dr, total, success, crit, fumble }) {
  if (crit) return `d20=20 → CRIT (auto-success, double damage, ignore armor)`;
  if (fumble) return `d20=1 → FUMBLE (auto-fail, weapon/armor damaged)`;
  const verdict = success ? 'SUCCESS' : 'FAIL';
  return `d20${modifier ? signed(modifier) : ''} = ${die}${modifier ? signed(modifier) : ''} = ${total} vs DR${dr} → ${verdict}`;
}
