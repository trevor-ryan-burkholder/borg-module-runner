import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdventureId } from '../utils/validate.js';
import { uid } from '../utils/id.js';
import { getActiveCampaignId, getCampaign, updateCampaign } from '../utils/campaigns.js';

const STORAGE_KEY = 'mb-module-runner-state';
// Scratch notes get their own key so keystroke-frequency edits don't rewrite
// the entire session blob each tick.
const SCRATCH_KEY = 'mb-module-runner-scratch';

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
    if (!parsed || typeof parsed !== 'object') return null;
    // Prefer the split scratch key when present; fall back to whatever's in the
    // legacy main blob for migration.
    try {
      const scratchRaw = localStorage.getItem(`${SCRATCH_KEY}:${adventureId}`);
      if (scratchRaw) {
        const scratch = JSON.parse(scratchRaw);
        if (scratch && typeof scratch === 'object') parsed.gmNotesScratch = scratch;
      }
    } catch { /* ignore */ }
    return parsed;
  } catch {
    return null;
  }
}

function saveSessionMain(adventureId, state) {
  try {
    // Strip scratch — it gets saved separately on its own debounce so heavy
    // note-typing doesn't bloat or churn the main blob.
    const { gmNotesScratch: _ignored, ...rest } = state;
    localStorage.setItem(`${STORAGE_KEY}:${adventureId}`, JSON.stringify(rest));
  } catch { /* quota / privacy — silent */ }
}

function saveScratch(adventureId, scratch) {
  try {
    if (scratch && Object.keys(scratch).length > 0) {
      localStorage.setItem(`${SCRATCH_KEY}:${adventureId}`, JSON.stringify(scratch));
    } else {
      localStorage.removeItem(`${SCRATCH_KEY}:${adventureId}`);
    }
  } catch { /* quota / privacy — silent */ }
}

const initialCombatState = {
  active: false,
  round: 0,
  combatants: [],
  initiative: { party: null, enemies: null },
};

const initialLoot = { silver: 0, items: [] };

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
    bookmarks: [],
    loot: initialLoot,
    graveyard: [],
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
  if (!Array.isArray(out.unlockedExits)) {
    out = { ...out, unlockedExits: [] };
  }
  if (!Array.isArray(out.visitedNodes)) {
    out = { ...out, visitedNodes: [] };
  }
  if (!Array.isArray(out.history)) {
    out = { ...out, history: [] };
  }
  if (typeof out.currentNode !== 'string' && out.currentNode != null) {
    out = { ...out, currentNode: null };
  }
  if (!Array.isArray(out.bookmarks)) {
    out = { ...out, bookmarks: [] };
  }
  if (!out.loot || typeof out.loot !== 'object') {
    out = { ...out, loot: initialLoot };
  } else if (!Array.isArray(out.loot.items) || !Number.isFinite(out.loot.silver)) {
    out = {
      ...out,
      loot: {
        silver: Number.isFinite(out.loot.silver) ? out.loot.silver : 0,
        items: Array.isArray(out.loot.items) ? out.loot.items : [],
      },
    };
  }
  if (!Array.isArray(out.graveyard)) {
    out = { ...out, graveyard: [] };
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

export function useAdventure(adventure, opts = {}) {
  const pendingJumpRef = opts.pendingJumpRef;
  const adventureId = getAdventureId(adventure);
  const startNode = adventure?.meta?.startNode;

  const nodeIndex = useMemo(() => {
    const idx = new Map();
    (adventure?.nodes ?? []).forEach((n) => idx.set(n.id, n));
    return idx;
  }, [adventure]);

  // When a campaign is active, its party/loot/graveyard shadow the per-adventure
  // session for those three slices. The session keeps its own progress
  // (currentNode/visited/history/scratch/combat/travel) but party-shaped state
  // travels with the GM between adventures.
  const overlayWithCampaign = (base) => {
    const id = getActiveCampaignId();
    if (!id) return base;
    const camp = getCampaign(id);
    if (!camp) return base;
    return {
      ...base,
      partyState: camp.partyState || base.partyState,
      loot: camp.loot || base.loot,
      graveyard: camp.graveyard || base.graveyard,
    };
  };

  // If the parent staged a pending node id (from a CrossRefSearch click), use
  // it as the starting node for the new adventure session so the runner lands
  // exactly where the user clicked instead of bouncing through startNode first.
  const consumePendingJump = () => {
    const id = pendingJumpRef?.current;
    // Clear unconditionally — a stale id that doesn't match the current
    // adventure shouldn't be carried into the next switch and surprise-jump.
    if (pendingJumpRef) pendingJumpRef.current = null;
    return id && nodeIndex.has(id) ? id : null;
  };

  const seedSession = () => {
    const restored = hydrate(loadSession(adventureId));
    const base =
      restored && nodeIndex.has(restored.currentNode) ? restored : freshState(startNode);
    const jump = consumePendingJump();
    if (jump) {
      base.currentNode = jump;
      base.visitedNodes = Array.from(new Set([...(base.visitedNodes || []), jump]));
      base.history = [...(base.history || []), jump];
    }
    return overlayWithCampaign(base);
  };

  const [state, setState] = useState(() => seedSession());

  // Re-initialize state when switching to a different adventure. The useState
  // initializer only runs once, so without this the previous adventure's
  // currentNode would persist and resolve to null against the new node index.
  const loadedIdRef = useRef(adventureId);
  useEffect(() => {
    if (loadedIdRef.current === adventureId) return;
    loadedIdRef.current = adventureId;
    setState(seedSession());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventureId, nodeIndex, startNode]);

  // Split-key debounced saves: the main session blob writes when any non-
  // scratch slice changes (200 ms); scratch notes write on their own slower
  // debounce (500 ms) so keystroke-heavy editing doesn't churn the main blob.
  // Both bail when the in-memory state hasn't caught up with an adventure
  // switch yet — otherwise the OLD adventure's state would persist under the
  // NEW adventure's storage key during the race between switch effect and
  // save effect on the same render.
  const stateMatchesAdventure =
    state.currentNode == null || nodeIndex.has(state.currentNode);
  useEffect(() => {
    if (!stateMatchesAdventure) return;
    const t = setTimeout(() => saveSessionMain(adventureId, state), 200);
    return () => clearTimeout(t);
  }, [
    adventureId,
    stateMatchesAdventure,
    state.currentNode,
    state.visitedNodes,
    state.history,
    state.unlockedExits,
    state.partyState,
    state.combatState,
    state.travelLog,
    state.bookmarks,
    state.loot,
    state.graveyard,
  ]);
  useEffect(() => {
    if (!stateMatchesAdventure) return;
    const t = setTimeout(() => saveScratch(adventureId, state.gmNotesScratch), 500);
    return () => clearTimeout(t);
  }, [adventureId, stateMatchesAdventure, state.gmNotesScratch]);

  // React to mid-session campaign activation: if the user activates a
  // campaign from CampaignPanel, immediately overlay the current state with
  // that campaign's party/loot/graveyard. Deactivating leaves current state
  // intact (no auto-clear); next adventure load starts fresh from session.
  useEffect(() => {
    const onChange = () => {
      const id = getActiveCampaignId();
      if (!id) return;
      const camp = getCampaign(id);
      if (!camp) return;
      setState((s) => ({
        ...s,
        partyState: camp.partyState || s.partyState,
        loot: camp.loot || s.loot,
        graveyard: camp.graveyard || s.graveyard,
      }));
    };
    window.addEventListener('mb-active-campaign-changed', onChange);
    return () => window.removeEventListener('mb-active-campaign-changed', onChange);
  }, []);

  // Mirror party/loot/graveyard back to the active campaign so changes in this
  // session carry to the next adventure in the campaign. Also debounced.
  useEffect(() => {
    const id = getActiveCampaignId();
    if (!id) return;
    const t = setTimeout(() => {
      try {
        updateCampaign(id, {
          partyState: state.partyState,
          loot: state.loot,
          graveyard: state.graveyard,
        });
      } catch {
        /* quota / privacy — silent */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [state.partyState, state.loot, state.graveyard]);

  // Whenever the party changes during an active fight, sync the combat tracker:
  // add new (or formerly-missing) PCs, drop removed PCs. Existing combatants
  // matched by memberId keep their combat HP and conditions — we never reset
  // those mid-fight.
  useEffect(() => {
    setState((s) => {
      if (!s.combatState?.active) return s;
      const pcCombatants = s.combatState.combatants.filter((c) => c.kind === 'pc');
      const otherCombatants = s.combatState.combatants.filter((c) => c.kind !== 'pc');
      const livingMembers = (s.partyState.members || []).filter((m) => !m.dead);

      const partyBackedPcs = livingMembers.map((m, idx) => {
        const existing = pcCombatants.find((c) =>
          m.id && c.memberId === m.id
            ? true
            : !m.id && c.memberId == null && c.partyIndex === idx
        );
        if (existing) return existing;
        return {
          id: `c-pc-${m.id || 'idx' + idx}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          kind: 'pc',
          partyIndex: idx,
          memberId: m.id ?? null,
          name: m.name || `PC ${idx + 1}`,
          hp: m.hp ?? m.hpMax ?? 4,
          hpMax: m.hpMax ?? m.hp ?? 4,
          conditions: m.conditions
            ? m.conditions.split(',').map((x) => x.trim()).filter(Boolean)
            : [],
          dead: false,
        };
      });

      // Preserve only TRUE guest combatants — ones the GM added via "+add"
      // with no memberId AND no partyIndex tying them to any party slot.
      // A combatant whose memberId no longer matches any living member means
      // the GM deleted that PC from the party tracker; it should drop out of
      // combat too, not survive as a phantom guest.
      const livingIds = new Set(livingMembers.map((m) => m.id).filter(Boolean));
      const usedIds = new Set(
        partyBackedPcs.filter((c) => pcCombatants.includes(c)).map((c) => c.id)
      );
      const guestPcs = pcCombatants.filter(
        (c) =>
          !usedIds.has(c.id) &&
          c.memberId == null &&
          (c.partyIndex == null || c.partyIndex >= livingMembers.length)
      );
      const newPcs = [...partyBackedPcs, ...guestPcs];

      // No change → return same state ref (no re-render, no loop).
      if (
        newPcs.length === pcCombatants.length &&
        newPcs.every((p, i) => p === pcCombatants[i])
      ) {
        return s;
      }
      return {
        ...s,
        combatState: { ...s.combatState, combatants: [...newPcs, ...otherCombatants] },
      };
    });
  }, [state.partyState.members, state.combatState?.active]);

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
          // Combat is the live source of truth at fight's end. A PC un-flagged
          // dead in CombatTracker should come back alive; conditions cleared in
          // combat should clear in the roster too.
          dead: !!c.dead,
          conditions: c.conditions.filter(Boolean).join(', '),
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

  const toggleBookmark = useCallback((nodeId) => {
    if (!nodeId) return;
    setState((s) => {
      const bookmarks = s.bookmarks ?? [];
      return {
        ...s,
        bookmarks: bookmarks.includes(nodeId)
          ? bookmarks.filter((id) => id !== nodeId)
          : [...bookmarks, nodeId],
      };
    });
  }, []);

  const updateLoot = useCallback((updater) => {
    setState((s) => ({
      ...s,
      loot: typeof updater === 'function' ? updater(s.loot ?? initialLoot) : updater,
    }));
  }, []);

  // Move a PC into the graveyard (canonical Mörk Borg: dead means dead). Snapshot
  // their stats + the room they died in so the GM can read it back later.
  const buryMember = useCallback(
    (memberId, deathInfo) => {
      setState((s) => {
        const member = s.partyState?.members?.find((m) => m.id === memberId);
        if (!member) return s;
        const node = nodeIndex.get(s.currentNode);
        const tomb = {
          id: `gv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: member.name || 'Unknown',
          class: member.class || '',
          hpMax: member.hpMax ?? null,
          omens: member.omens ?? null,
          diedAt: node?.title || s.currentNode || 'an unknown place',
          diedAtNode: s.currentNode,
          ...deathInfo,
          at: Date.now(),
        };
        return {
          ...s,
          partyState: {
            ...s.partyState,
            members: s.partyState.members.filter((m) => m.id !== memberId),
            // No deaths bump here — the PC was already counted when their
            // dead flag was first set (markDead / rollBroken / damagePC /
            // endCombat). Counting again on bury double-counts.
          },
          graveyard: [...(s.graveyard ?? []), tomb],
        };
      });
    },
    [nodeIndex]
  );

  const exhumeMember = useCallback((tombId) => {
    setState((s) => ({
      ...s,
      graveyard: (s.graveyard ?? []).filter((g) => g.id !== tombId),
    }));
  }, []);

  // Granular reset: pass an options bag of slices to wipe. With nothing passed,
  // every slice is cleared (the old behaviour).
  const reset = useCallback(
    (opts) => {
      const all = !opts || Object.keys(opts).length === 0;
      const wipe = {
        history: all || opts.history,
        party: all || opts.party,
        combat: all || opts.combat,
        travel: all || opts.travel,
        scratchNotes: all || opts.scratchNotes,
        bookmarks: all || opts.bookmarks,
        loot: all || opts.loot,
        graveyard: all || opts.graveyard,
      };
      setState((s) => ({
        ...s,
        currentNode: wipe.history ? startNode : s.currentNode,
        visitedNodes: wipe.history ? (startNode ? [startNode] : []) : s.visitedNodes,
        history: wipe.history ? (startNode ? [startNode] : []) : s.history,
        unlockedExits: wipe.history ? [] : s.unlockedExits,
        partyState: wipe.party ? initialPartyState : s.partyState,
        combatState: wipe.combat ? initialCombatState : s.combatState,
        travelLog: wipe.travel ? [] : (s.travelLog ?? []),
        gmNotesScratch: wipe.scratchNotes ? {} : (s.gmNotesScratch ?? {}),
        bookmarks: wipe.bookmarks ? [] : (s.bookmarks ?? []),
        loot: wipe.loot ? initialLoot : (s.loot ?? initialLoot),
        graveyard: wipe.graveyard ? [] : (s.graveyard ?? []),
      }));
    },
    [startNode]
  );

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
    toggleBookmark,
    updateLoot,
    buryMember,
    exhumeMember,
    reset,
    nodeById,
  };
}
