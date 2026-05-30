import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdventureId } from '../utils/validate.js';
import { uid } from '../utils/id.js';

const STORAGE_KEY = 'mb-module-runner-state';

const initialPartyState = {
  members: [],
  omens: 3,
  deaths: 0,
};

function loadSession(adventureId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${adventureId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(adventureId, state) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${adventureId}`, JSON.stringify(state));
  } catch {
    /* quota or privacy mode — silent */
  }
}

const initialCombatState = {
  active: false,
  round: 0,
  combatants: [],
  initiative: { party: null, enemies: null },
};

function freshState(startNode) {
  return {
    currentNode: startNode,
    visitedNodes: startNode ? [startNode] : [],
    history: startNode ? [startNode] : [],
    partyState: initialPartyState,
    unlockedExits: [],
    gmNotesScratch: {},
    combatState: initialCombatState,
    travelLog: [],
  };
}

// Backfill missing slices on a state restored from localStorage. Pre-existing
// sessions won't have newer fields and would otherwise read as undefined.
function hydrate(restored) {
  if (!restored) return restored;
  let out = restored;
  if (!out.gmNotesScratch || typeof out.gmNotesScratch !== 'object') {
    out = { ...out, gmNotesScratch: {} };
  }
  if (!out.combatState || typeof out.combatState !== 'object') {
    out = { ...out, combatState: initialCombatState };
  }
  if (!Array.isArray(out.travelLog)) {
    out = { ...out, travelLog: [] };
  }
  // Backfill partyState entirely if missing or shaped wrong — a corrupted save
  // or schema change in the past would otherwise crash on first render.
  if (!out.partyState || typeof out.partyState !== 'object') {
    out = { ...out, partyState: initialPartyState };
  } else {
    const p = out.partyState;
    const fixed = {
      members: Array.isArray(p.members) ? p.members : [],
      omens: Number.isFinite(p.omens) ? p.omens : initialPartyState.omens,
      deaths: Number.isFinite(p.deaths) ? p.deaths : initialPartyState.deaths,
    };
    out = { ...out, partyState: fixed };
  }
  // Backfill stable ids on party members saved before ids existed, so combat
  // sync can match them reliably.
  const members = out.partyState?.members;
  if (Array.isArray(members) && members.some((m) => !m.id)) {
    out = {
      ...out,
      partyState: {
        ...out.partyState,
        members: members.map((m) => (m.id ? m : { ...m, id: uid('pc') })),
      },
    };
  }
  return out;
}

export function useAdventure(adventure) {
  const adventureId = getAdventureId(adventure);
  const startNode = adventure?.meta?.startNode;

  const nodeIndex = useMemo(() => {
    const idx = new Map();
    (adventure?.nodes ?? []).forEach((n) => idx.set(n.id, n));
    return idx;
  }, [adventure]);

  const [state, setState] = useState(() => {
    const restored = hydrate(loadSession(adventureId));
    if (restored && nodeIndex.has(restored.currentNode)) return restored;
    return freshState(startNode);
  });

  // Re-initialize state when switching to a different adventure. The useState
  // initializer only runs once, so without this the previous adventure's
  // currentNode would persist and resolve to null against the new node index.
  const loadedIdRef = useRef(adventureId);
  useEffect(() => {
    if (loadedIdRef.current === adventureId) return;
    loadedIdRef.current = adventureId;
    const restored = hydrate(loadSession(adventureId));
    setState(
      restored && nodeIndex.has(restored.currentNode)
        ? restored
        : freshState(startNode)
    );
  }, [adventureId, nodeIndex, startNode]);

  useEffect(() => {
    saveSession(adventureId, state);
  }, [adventureId, state]);

  const currentNode = nodeIndex.get(state.currentNode) ?? null;

  const goToNode = useCallback(
    (nodeId) => {
      if (!nodeIndex.has(nodeId)) return;
      setState((s) => ({
        ...s,
        currentNode: nodeId,
        visitedNodes: s.visitedNodes.includes(nodeId)
          ? s.visitedNodes
          : [...s.visitedNodes, nodeId],
        history: [...s.history, nodeId],
      }));
    },
    [nodeIndex]
  );

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.history.length <= 1) return s;
      const history = s.history.slice(0, -1);
      return { ...s, currentNode: history[history.length - 1], history };
    });
  }, []);

  const unlockExit = useCallback((exitId) => {
    setState((s) =>
      s.unlockedExits.includes(exitId)
        ? s
        : { ...s, unlockedExits: [...s.unlockedExits, exitId] }
    );
  }, []);

  const updateParty = useCallback((updater) => {
    setState((s) => ({
      ...s,
      partyState: typeof updater === 'function' ? updater(s.partyState) : updater,
    }));
  }, []);

  const setScratchNotes = useCallback((nodeId, text) => {
    if (!nodeId) return;
    setState((s) => ({
      ...s,
      gmNotesScratch: { ...s.gmNotesScratch, [nodeId]: text },
    }));
  }, []);

  const appendScratchNotes = useCallback((nodeId, addition) => {
    if (!nodeId || !addition) return;
    setState((s) => {
      const existing = s.gmNotesScratch[nodeId] ?? '';
      const joined = existing ? `${existing}\n\n${addition}` : addition;
      return { ...s, gmNotesScratch: { ...s.gmNotesScratch, [nodeId]: joined } };
    });
  }, []);

  const setCombat = useCallback((updater) => {
    setState((s) => ({
      ...s,
      combatState: typeof updater === 'function' ? updater(s.combatState) : updater,
    }));
  }, []);

  const endCombat = useCallback(() => {
    setState((s) => {
      // Sync PC combatants back to partyState. Match by stable memberId so the
      // sync survives roster edits made mid-combat; fall back to partyIndex for
      // combatants created before member ids existed.
      const pcs = s.combatState.combatants.filter((c) => c.kind === 'pc');
      let newDeaths = 0;
      const updatedMembers = s.partyState.members.map((m, idx) => {
        const c = pcs.find((x) =>
          x.memberId && m.id ? x.memberId === m.id : x.partyIndex === idx
        );
        if (!c) return m;
        if (c.dead && !m.dead) newDeaths += 1;
        return {
          ...m,
          hp: c.hp,
          dead: c.dead || m.dead,
          conditions: c.conditions.length ? c.conditions.join(', ') : m.conditions,
        };
      });
      return {
        ...s,
        partyState: {
          ...s.partyState,
          members: updatedMembers,
          deaths: (s.partyState.deaths ?? 0) + newDeaths,
        },
        combatState: initialCombatState,
      };
    });
  }, []);

  const appendTravelEntry = useCallback((entry) => {
    setState((s) => ({ ...s, travelLog: [...(s.travelLog ?? []), entry] }));
  }, []);

  const updateTravelEntry = useCallback((idx, patch) => {
    setState((s) => ({
      ...s,
      travelLog: (s.travelLog ?? []).map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  }, []);

  const clearTravelLog = useCallback(() => {
    setState((s) => ({ ...s, travelLog: [] }));
  }, []);

  const reset = useCallback(() => {
    setState(freshState(startNode));
  }, [startNode]);

  const nodeById = useCallback((id) => nodeIndex.get(id) ?? null, [nodeIndex]);

  return {
    state,
    currentNode,
    goToNode,
    goBack,
    unlockExit,
    updateParty,
    setScratchNotes,
    appendScratchNotes,
    setCombat,
    endCombat,
    appendTravelEntry,
    updateTravelEntry,
    clearTravelLog,
    reset,
    nodeById,
  };
}
