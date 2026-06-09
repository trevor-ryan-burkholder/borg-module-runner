// Light-weight adventure schema validation. Not a full JSON Schema validator —
// just enough to catch the common authoring mistakes before the app tries to run it.

const SUPPORTED_SYSTEMS = ['morkborg', 'ronin-borg'];

export function validateAdventure(json) {
  const errors = [];
  const warnings = [];

  if (!json || typeof json !== 'object') {
    return { ok: false, errors: ['Adventure must be a JSON object.'], warnings };
  }

  const meta = json.meta;
  if (!meta || typeof meta !== 'object') {
    errors.push('Missing meta object.');
  } else {
    if (!meta.title) errors.push('meta.title is required.');
    if (!meta.startNode) errors.push('meta.startNode is required.');
    if (meta.system && !SUPPORTED_SYSTEMS.includes(meta.system)) {
      warnings.push(
        `Unknown meta.system "${meta.system}". Known: ${SUPPORTED_SYSTEMS.join(', ')}. The app will render with default (Mörk Borg) cards.`
      );
    }
  }

  const nodes = json.nodes;
  if (!Array.isArray(nodes)) {
    errors.push('nodes must be an array.');
    return { ok: false, errors, warnings };
  }
  if (nodes.length === 0) {
    errors.push('At least one node is required.');
    return { ok: false, errors, warnings };
  }

  const ids = new Set();
  const exitIds = new Set();
  for (const [i, node] of nodes.entries()) {
    const where = node?.id ? `node "${node.id}"` : `nodes[${i}]`;
    if (!node?.id) errors.push(`${where}: missing id.`);
    else if (ids.has(node.id)) errors.push(`${where}: duplicate id.`);
    else ids.add(node.id);

    if (!node?.title) warnings.push(`${where}: missing title.`);
    if (node?.exits && !Array.isArray(node.exits))
      errors.push(`${where}: exits must be an array.`);

    for (const exit of node?.exits ?? []) {
      if (exit?.id) {
        // Duplicate exit ids collapse React keys at render time, so this is an
        // authoring error, not a warning.
        if (exitIds.has(exit.id)) errors.push(`${node.id}: duplicate exit id "${exit.id}".`);
        exitIds.add(exit.id);
      } else {
        // Missing exit id falls back to array-index keys in React. That works
        // as long as the order is stable but breaks unlock tracking — the
        // runner keys unlocked exits by id, so a no-id exit can never be
        // unlocked from the UI.
        warnings.push(
          `${node?.id || 'node'}: exit "${exit?.label || exit?.target || '?'}" is missing an id (unlock/persistence cannot key this exit).`
        );
      }
    }
  }

  if (meta?.startNode && !ids.has(meta.startNode))
    errors.push(`meta.startNode "${meta.startNode}" does not match any node id.`);

  // Cross-check exit targets + self-references.
  for (const node of nodes) {
    for (const exit of node.exits ?? []) {
      if (!exit.target) {
        if (!exit.condition) {
          warnings.push(
            `${node.id}: exit "${exit.label || exit.id}" has no target and no condition (dead-end exit will alert the user when tapped).`
          );
        }
      } else if (!ids.has(exit.target)) {
        warnings.push(
          `${node.id}: exit "${exit.label || exit.id}" targets unknown node "${exit.target}".`
        );
      } else if (exit.target === node.id) {
        warnings.push(
          `${node.id}: exit "${exit.label || exit.id}" targets itself (intentional? procedural-hub style is fine).`
        );
      }
    }
  }

  // Reachability from startNode.
  if (meta?.startNode && ids.has(meta.startNode)) {
    const reachable = reachableFrom(nodes, meta.startNode, { allowLocked: true });
    const unreachable = [...ids].filter((id) => !reachable.has(id));
    if (unreachable.length > 0) {
      warnings.push(
        `${unreachable.length} unreachable node${unreachable.length > 1 ? 's' : ''} from startNode: ${unreachable.slice(0, 5).join(', ')}${unreachable.length > 5 ? ` (+${unreachable.length - 5} more)` : ''}.`
      );
    }

    // Locked-only reachability: any node only reachable through a locked exit
    // means a party that never finds the unlock spends the whole adventure
    // stuck on one side of it. Flag those so the author can verify a key
    // exists somewhere reachable without the lock.
    const reachableUnlocked = reachableFrom(nodes, meta.startNode, { allowLocked: false });
    const lockedOnly = [...reachable].filter(
      (id) => id !== meta.startNode && !reachableUnlocked.has(id)
    );
    if (lockedOnly.length > 0) {
      warnings.push(
        `${lockedOnly.length} node${lockedOnly.length > 1 ? 's' : ''} reachable only through locked exits: ${lockedOnly.slice(0, 5).join(', ')}${lockedOnly.length > 5 ? ` (+${lockedOnly.length - 5} more)` : ''}. Verify the unlock condition is discoverable.`
      );
    }
  }

  // Dead ends.
  for (const node of nodes) {
    const hasExits = (node.exits ?? []).some((e) => e?.target);
    const isEnd = (node.tags ?? []).includes('end') || (node.tags ?? []).includes('climax');
    if (!hasExits && !isEnd) {
      warnings.push(
        `${node.id}: no exits and not tagged "end" or "climax" (intentional dead-end? tag it to silence this warning).`
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function reachableFrom(nodes, startId, opts = {}) {
  const allowLocked = opts.allowLocked !== false;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const reached = new Set();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    if (reached.has(id)) continue;
    reached.add(id);
    const node = byId.get(id);
    if (!node) continue;
    for (const exit of node.exits ?? []) {
      // A locked exit with a `condition` string is documented — the author
      // told the GM how to unlock it. Treat it as passable for the
      // locked-only-reachability check (the gate is a puzzle, not a forgotten
      // dead-end). Locked exits with NO condition are the dangerous case: a
      // party that doesn't stumble on the key has no recourse.
      if (!allowLocked && exit?.locked && !exit?.condition) continue;
      if (exit?.target && byId.has(exit.target) && !reached.has(exit.target)) {
        queue.push(exit.target);
      }
    }
  }
  return reached;
}

export function getSystem(adventure) {
  return adventure?.meta?.system || 'morkborg';
}

export function getAdventureId(adventure) {
  return adventure?.meta?.id || slugify(adventure?.meta?.title || 'untitled');
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled';
}
