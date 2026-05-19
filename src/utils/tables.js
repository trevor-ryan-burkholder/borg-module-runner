import { rollDie } from './dice.js';

// Generic table roller. Supports three input shapes:
//
//   1. Flat array:                ['a', 'b', 'c']                       — uniform 1-in-N pick
//   2. Weighted array of objects: [{ weight: 3, value: 'a' }, ...]      — weight defaults to 1
//   3. Dice-keyed object:         { '1-3': 'a', '4-5': 'b', '6': 'c' }  — keys are inclusive ranges over rollDie(sides)
//
// All forms return an object: { value, index, roll? } where `roll` is set
// only for the dice-keyed form so callers can show "d6=4 → b" if desired.

export function roll(table, options = {}) {
  if (table == null) throw new Error('roll: table is required');

  if (Array.isArray(table)) {
    if (table.length === 0) throw new Error('roll: table is empty');
    if (isWeighted(table)) return rollWeighted(table);
    return rollFlat(table);
  }

  if (typeof table === 'object') {
    return rollDiceKeyed(table, options.sides);
  }

  throw new Error('roll: unsupported table shape');
}

// Roll once, return only the value. Convenience for callers that don't
// need the index or the underlying die roll.
export function rollValue(table, options = {}) {
  return roll(table, options).value;
}

// Roll N distinct values without replacement. Falls back to with-replacement
// once the table is exhausted. Only meaningful for flat / weighted arrays.
export function rollN(table, n, options = {}) {
  if (!Array.isArray(table)) throw new Error('rollN: requires an array table');
  const pool = table.slice();
  const out = [];
  for (let i = 0; i < n; i++) {
    if (pool.length === 0) {
      // Exhausted — keep rolling against the original table with replacement.
      out.push(roll(table, options));
      continue;
    }
    const result = roll(pool, options);
    out.push(result);
    pool.splice(result.index, 1);
  }
  return out;
}

function isWeighted(arr) {
  return (
    arr.length > 0 &&
    typeof arr[0] === 'object' &&
    arr[0] !== null &&
    'value' in arr[0]
  );
}

function rollFlat(arr) {
  const index = Math.floor(Math.random() * arr.length);
  return { value: arr[index], index };
}

function rollWeighted(arr) {
  const total = arr.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  let pick = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    pick -= arr[i].weight ?? 1;
    if (pick <= 0) return { value: arr[i].value, index: i };
  }
  // Floating-point fallthrough — return the last entry.
  return { value: arr[arr.length - 1].value, index: arr.length - 1 };
}

function rollDiceKeyed(obj, explicitSides) {
  const keys = Object.keys(obj);
  if (keys.length === 0) throw new Error('roll: dice-keyed table is empty');

  // Parse keys into [min, max] ranges. "3" → [3, 3], "1-3" → [1, 3].
  const ranges = keys.map((k) => {
    const parts = k.split('-').map((s) => parseInt(s.trim(), 10));
    if (parts.some(Number.isNaN)) {
      throw new Error(`roll: invalid dice-keyed table key "${k}"`);
    }
    const min = parts[0];
    const max = parts.length > 1 ? parts[1] : parts[0];
    return { key: k, min, max };
  });

  const maxFace = Math.max(...ranges.map((r) => r.max));
  const sides = explicitSides ?? maxFace;
  const die = rollDie(sides);

  const hit = ranges.find((r) => die >= r.min && die <= r.max);
  if (!hit) {
    // Re-roll out-of-range results so we always return something. This shouldn't
    // happen if the table covers 1..sides, but it can if `sides` was passed in.
    return rollDiceKeyed(obj, explicitSides);
  }

  return { value: obj[hit.key], index: keys.indexOf(hit.key), roll: die, sides };
}
