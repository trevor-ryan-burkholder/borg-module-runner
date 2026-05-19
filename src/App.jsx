import { useCallback, useEffect, useState } from 'react';
import { useAdventure } from './hooks/useAdventure.js';
import {
  getBundledAdventure,
  getRulesForSystem,
  isBundled,
} from './utils/loadAdventure.js';
import {
  getUserAdventure,
  getLastLoaded,
  setLastLoaded,
  saveUserAdventure,
} from './utils/library.js';
import {
  readShareFromLocation,
  decodeAdventureFromHashPayload,
  clearShareFromLocation,
} from './utils/share.js';
import { validateAdventure, getAdventureId, getSystem } from './utils/validate.js';

import NodeView from './components/NodeView.jsx';
import RulesPanel from './components/RulesPanel.jsx';
import BreadcrumbTrail from './components/BreadcrumbTrail.jsx';
import PartyTracker from './components/PartyTracker.jsx';
import AdventurePicker from './components/AdventurePicker.jsx';
import AdventureBuilder from './components/AdventureBuilder.jsx';
import ShareDialog from './components/ShareDialog.jsx';
import DiceTray from './components/DiceTray.jsx';
import MiseryTracker from './components/MiseryTracker.jsx';
import MapView from './components/MapView.jsx';
import NpcGenerator from './components/NpcGenerator.jsx';
import CombatTracker, { buildCombatants } from './components/CombatTracker.jsx';
import OverlandTravel from './components/OverlandTravel.jsx';
import DungeonGenerator from './components/DungeonGenerator.jsx';
import AmbientMixer from './components/AmbientMixer.jsx';
import Bestiary from './components/Bestiary.jsx';
import RandomTables from './components/RandomTables.jsx';

const DEFAULT_ADVENTURE_ID = 'graves-left-wanting';

function AdventureRuntime({ adventure, ephemeral, onClearEphemeral, onChangeAdventure, onLoadEphemeral }) {
  const {
    state,
    currentNode,
    goToNode,
    goBack,
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
  } = useAdventure(adventure);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [miseryOpen, setMiseryOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [npcOpen, setNpcOpen] = useState(false);
  const [combatOpen, setCombatOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);
  const [dungeonOpen, setDungeonOpen] = useState(false);
  const [ambientOpen, setAmbientOpen] = useState(false);
  const [bestiaryOpen, setBestiaryOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);

  const system = getSystem(adventure);
  const rules = getRulesForSystem(system);
  const visited = currentNode ? state.visitedNodes.includes(currentNode.id) : false;

  // Apply system attribute to document root for CSS theming.
  useEffect(() => {
    document.documentElement.setAttribute('data-system', system);
    return () => document.documentElement.removeAttribute('data-system');
  }, [system]);

  const handleStartCombat = useCallback(
    (enemies) => {
      const combatants = buildCombatants({
        enemies: enemies ?? [],
        partyMembers: state.partyState.members,
      });
      setCombat({ active: true, round: 1, combatants });
      setCombatOpen(true);
    },
    [setCombat, state.partyState.members]
  );

  const handleEndCombat = useCallback(() => {
    endCombat();
    setCombatOpen(false);
  }, [endCombat]);

  const handleExit = useCallback(
    (exit) => {
      if (!exit.target) {
        window.alert(
          exit.condition
            ? `This exit is intentionally open-ended:\n\n  ${exit.condition}`
            : 'This exit has no target node.'
        );
        return;
      }
      if (exit.locked && exit.condition) {
        const proceed = window.confirm(
          `This exit is conditional:\n\n  ${exit.condition}\n\nProceed anyway?`
        );
        if (!proceed) return;
      }
      goToNode(exit.target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [goToNode]
  );

  // Keyboard shortcuts. Skip when focus is in a form element.
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const isFormElement =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Escape closes the topmost panel, and must work even when a form element
      // (e.g. the bestiary search box) has focus — otherwise the user is trapped.
      if (e.key === 'Escape') {
        if (dungeonOpen) setDungeonOpen(false);
        else if (builderOpen) setBuilderOpen(false);
        else if (pickerOpen) setPickerOpen(false);
        else if (shareOpen) setShareOpen(false);
        else if (mapOpen) setMapOpen(false);
        else if (rulesOpen) setRulesOpen(false);
        else if (miseryOpen) setMiseryOpen(false);
        else if (diceOpen) setDiceOpen(false);
        else if (npcOpen) setNpcOpen(false);
        else if (combatOpen) setCombatOpen(false);
        else if (travelOpen) setTravelOpen(false);
        else if (ambientOpen) setAmbientOpen(false);
        else if (bestiaryOpen) setBestiaryOpen(false);
        else if (tablesOpen) setTablesOpen(false);
        else if (partyOpen) setPartyOpen(false);
        return;
      }

      // All other shortcuts are single-key and must not fire while typing.
      if (isFormElement) return;

      switch (e.key.toLowerCase()) {
        case '?':
          setRulesOpen((o) => !o);
          break;
        case 'b':
          if (state.history.length > 1) goBack();
          break;
        case 'p':
          setPartyOpen((o) => !o);
          break;
        case 'd':
          setDiceOpen((o) => !o);
          break;
        case 'm':
          setMapOpen((o) => !o);
          break;
        case 'k':
          setMiseryOpen((o) => !o);
          break;
        case 'l':
          setPickerOpen((o) => !o);
          break;
        case 's':
          setShareOpen((o) => !o);
          break;
        case 'n':
          setNpcOpen((o) => !o);
          break;
        case 'c':
          setCombatOpen((o) => !o);
          break;
        case 't':
          setTravelOpen((o) => !o);
          break;
        case 'a':
          setAmbientOpen((o) => !o);
          break;
        case 'e':
          setBestiaryOpen((o) => !o);
          break;
        case 'r':
          setTablesOpen((o) => !o);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.history.length, goBack, builderOpen, pickerOpen, shareOpen, mapOpen, rulesOpen, miseryOpen, diceOpen, partyOpen, npcOpen, combatOpen, travelOpen, dungeonOpen, ambientOpen, bestiaryOpen, tablesOpen]);

  return (
    <>
      <header className="app-bar">
        <div className="app-bar__brand">
          <button
            type="button"
            className="brand__home"
            onClick={() => setPickerOpen(true)}
            title="Open library (L)"
          >
            <span className="brand__skull" aria-hidden="true">☠</span>
            <span className="brand__title">
              {system === 'ronin-borg' ? 'RONIN BORG' : 'MÖRK BORG'}
            </span>
            <span className="brand__sub">module runner</span>
          </button>
        </div>

        <div className="app-bar__actions">
          <button
            type="button"
            className="iconbtn"
            onClick={goBack}
            disabled={state.history.length <= 1}
            title="Step back one node (B)"
          >
            ◀ back
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setMapOpen(true)}
            title="Adventure map (M)"
          >
            ⌖ map
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setDiceOpen((o) => !o)}
            title="Dice tray (D)"
            aria-pressed={diceOpen}
          >
            ⚂ dice
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setMiseryOpen((o) => !o)}
            title="Calendar of Nechrubel (K)"
            aria-pressed={miseryOpen}
          >
            ☉ misery
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setPartyOpen((o) => !o)}
            title="Party tracker (P)"
            aria-pressed={partyOpen}
          >
            ⚐ party
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setNpcOpen((o) => !o)}
            title="NPC generator (N)"
            aria-pressed={npcOpen}
          >
            ☥ npc
          </button>
          <button
            type="button"
            className={`iconbtn ${state.combatState?.active ? 'iconbtn--danger' : ''}`}
            onClick={() => setCombatOpen((o) => !o)}
            title="Combat tracker (C)"
            aria-pressed={combatOpen}
          >
            ⚔ combat{state.combatState?.active ? ` · r${state.combatState.round}` : ''}
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setTravelOpen((o) => !o)}
            title="Overland travel (T)"
            aria-pressed={travelOpen}
          >
            ☍ travel
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setAmbientOpen((o) => !o)}
            title="Ambient sound (A)"
            aria-pressed={ambientOpen}
          >
            ♪ ambient
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setBestiaryOpen((o) => !o)}
            title="Bestiary (E)"
            aria-pressed={bestiaryOpen}
          >
            ⛧ bestiary
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setTablesOpen((o) => !o)}
            title="Random tables (R)"
            aria-pressed={tablesOpen}
          >
            ⚅ tables
          </button>
          <button
            type="button"
            className="iconbtn iconbtn--rules"
            onClick={() => setRulesOpen(true)}
            title="Rules reference (?)"
          >
            ☠ rules
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setPickerOpen(true)}
            title="Adventure library (L)"
          >
            ⌘ library
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setBuilderOpen(true)}
            title="Adventure builder"
          >
            ✎ build
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setDungeonOpen(true)}
            title="Generate a dungeon"
          >
            ✦ dungeon
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setShareOpen(true)}
            title="Share this adventure (S)"
          >
            ⤴ share
          </button>
          <button
            type="button"
            className="iconbtn iconbtn--danger"
            onClick={() => {
              if (window.confirm('Reset the adventure to the start node? Visited history and party will be cleared.')) {
                reset();
              }
            }}
            title="Reset session"
          >
            ⟲ reset
          </button>
        </div>
      </header>

      {ephemeral && (
        <div className="ephemeral-banner">
          Unsaved session — not in your library. Refreshing will lose it.{' '}
          <button
            type="button"
            className="iconbtn"
            onClick={() => {
              const id = getAdventureId(adventure);
              const toSave = { ...adventure, meta: { ...adventure.meta, id } };
              try {
                saveUserAdventure(toSave);
                onClearEphemeral();
                onChangeAdventure(id, toSave);
              } catch (err) {
                window.alert(`Could not save: ${err.message}`);
              }
            }}
            title="Persist this adventure to your library"
          >
            ⤓ save to library
          </button>{' '}
          <button
            type="button"
            className="iconbtn"
            onClick={() => {
              onClearEphemeral();
              onChangeAdventure(DEFAULT_ADVENTURE_ID);
            }}
          >
            discard
          </button>
        </div>
      )}

      <BreadcrumbTrail
        history={state.history}
        currentNode={state.currentNode}
        nodeById={nodeById}
        onJump={goToNode}
      />

      <NodeView
        adventure={adventure}
        node={currentNode}
        visited={visited}
        unlockedExits={state.unlockedExits}
        onExit={handleExit}
        scratchNotes={currentNode ? state.gmNotesScratch?.[currentNode.id] ?? '' : ''}
        onScratchChange={
          currentNode ? (text) => setScratchNotes(currentNode.id, text) : undefined
        }
        onStartCombat={handleStartCombat}
      />

      {partyOpen && (
        <PartyTracker
          party={state.partyState}
          onUpdate={updateParty}
          onDismiss={() => setPartyOpen(false)}
        />
      )}

      <DiceTray open={diceOpen} onClose={() => setDiceOpen(false)} />
      <MiseryTracker open={miseryOpen} onClose={() => setMiseryOpen(false)} />
      <NpcGenerator
        open={npcOpen}
        onClose={() => setNpcOpen(false)}
        canAddToNotes={!!currentNode}
        onAddToNotes={(text) => {
          if (currentNode) appendScratchNotes(currentNode.id, text);
        }}
      />
      <CombatTracker
        open={combatOpen}
        onClose={() => setCombatOpen(false)}
        combatState={state.combatState ?? { active: false, round: 0, combatants: [] }}
        setCombat={setCombat}
        endCombat={handleEndCombat}
      />
      <OverlandTravel
        open={travelOpen}
        onClose={() => setTravelOpen(false)}
        travelLog={state.travelLog ?? []}
        appendEntry={appendTravelEntry}
        updateEntry={updateTravelEntry}
        clearLog={clearTravelLog}
      />
      <AmbientMixer open={ambientOpen} onClose={() => setAmbientOpen(false)} />
      <Bestiary
        open={bestiaryOpen}
        onClose={() => setBestiaryOpen(false)}
        canAddToNotes={!!currentNode}
        onAddToNotes={(text) => {
          if (currentNode) appendScratchNotes(currentNode.id, text);
        }}
      />
      <RandomTables
        open={tablesOpen}
        onClose={() => setTablesOpen(false)}
        canAddToNotes={!!currentNode}
        onAddToNotes={(text) => {
          if (currentNode) appendScratchNotes(currentNode.id, text);
        }}
      />

      {mapOpen && (
        <MapView
          adventure={adventure}
          currentNode={state.currentNode}
          visited={state.visitedNodes}
          onJump={(id) => {
            goToNode(id);
            setMapOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onClose={() => setMapOpen(false)}
        />
      )}

      <RulesPanel rules={rules} open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {pickerOpen && (
        <AdventurePicker
          onPick={({ id, adventure: chosen }) => {
            setPickerOpen(false);
            onChangeAdventure(id, chosen);
          }}
          onOpenBuilder={() => {
            setPickerOpen(false);
            setBuilderOpen(true);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {builderOpen && (
        <AdventureBuilder
          initial={adventure}
          onClose={() => setBuilderOpen(false)}
          onSave={(saved, opts) => {
            if (opts?.thenLoad) {
              setBuilderOpen(false);
              onChangeAdventure(getAdventureId(saved), saved);
            }
          }}
        />
      )}

      <DungeonGenerator
        open={dungeonOpen}
        onClose={() => setDungeonOpen(false)}
        onRun={(generatedAdventure) => {
          const v = validateAdventure(generatedAdventure);
          if (!v.ok) {
            window.alert(`Generated dungeon is malformed: ${v.errors.join(' · ')}`);
            return;
          }
          setDungeonOpen(false);
          // Load ephemerally — the GM can persist via the banner's "save to library".
          onLoadEphemeral(generatedAdventure);
        }}
      />

      {shareOpen && (
        <ShareDialog adventure={adventure} onClose={() => setShareOpen(false)} />
      )}

      <footer className="app-foot">
        <small>{adventure.meta.license}</small>
        <small className="app-foot__keys">
          shortcuts: ? rules · b back · l library · m map · d dice · k calendar · p party · n npc · c combat · t travel · a ambient · e bestiary · r tables · s share · esc close
        </small>
      </footer>
    </>
  );
}

export default function App() {
  const [adventure, setAdventure] = useState(null);
  const [ephemeral, setEphemeral] = useState(false);
  const [shareLoadError, setShareLoadError] = useState(null);

  // Initial load: share-link payload > last loaded > default.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const sharePayload = readShareFromLocation();
      if (sharePayload) {
        try {
          const decoded = await decodeAdventureFromHashPayload(sharePayload);
          const v = validateAdventure(decoded);
          if (!v.ok) {
            setShareLoadError(`Share link is malformed: ${v.errors.join(' · ')}`);
          } else {
            if (cancelled) return;
            setAdventure(decoded);
            setEphemeral(true);
            clearShareFromLocation();
            return;
          }
        } catch (e) {
          setShareLoadError(`Could not load share link: ${e.message}`);
        }
      }

      const lastId = getLastLoaded();
      if (lastId) {
        const fromUser = getUserAdventure(lastId);
        if (fromUser) {
          if (!cancelled) setAdventure(fromUser);
          return;
        }
        if (isBundled(lastId)) {
          if (!cancelled) setAdventure(getBundledAdventure(lastId));
          return;
        }
      }

      if (!cancelled) setAdventure(getBundledAdventure(DEFAULT_ADVENTURE_ID));
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChangeAdventure = useCallback((id, advObject) => {
    let next = advObject;
    if (!next) {
      next = isBundled(id) ? getBundledAdventure(id) : getUserAdventure(id);
    }
    if (!next) {
      window.alert(`Adventure "${id}" not found.`);
      return;
    }
    setAdventure(next);
    setEphemeral(false);
    setLastLoaded(id);
  }, []);

  // Load an adventure object without persisting a lastLoaded pointer — used for
  // generated dungeons. The session is marked ephemeral; the user can save it.
  const handleLoadEphemeral = useCallback((advObject) => {
    if (!advObject) return;
    setAdventure(advObject);
    setEphemeral(true);
  }, []);

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />
      <div className="scanline" aria-hidden="true" />

      {shareLoadError && (
        <div className="ephemeral-banner ephemeral-banner--error">
          ⚠ {shareLoadError}{' '}
          <button
            type="button"
            className="iconbtn"
            onClick={() => setShareLoadError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {adventure ? (
        <AdventureRuntime
          adventure={adventure}
          ephemeral={ephemeral}
          onClearEphemeral={() => setEphemeral(false)}
          onChangeAdventure={handleChangeAdventure}
          onLoadEphemeral={handleLoadEphemeral}
        />
      ) : (
        <div className="loading">
          <p>Reading the will of the dying world…</p>
        </div>
      )}
    </div>
  );
}
