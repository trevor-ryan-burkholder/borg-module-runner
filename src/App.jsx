import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// Eagerly loaded — needed for the first paint or to keep state alive:
import NodeView from './components/NodeView.jsx';
import RulesPanel from './components/RulesPanel.jsx';
import BreadcrumbTrail from './components/BreadcrumbTrail.jsx';
import PartyTracker from './components/PartyTracker.jsx';
import DiceTray from './components/DiceTray.jsx';
import MiseryTracker from './components/MiseryTracker.jsx';
import CombatTracker, { buildCombatants, rollSideInitiative } from './components/CombatTracker.jsx';
import AmbientMixer from './components/AmbientMixer.jsx';

// Lazily loaded — fetched the first time the user opens the panel:
const AdventurePicker = lazy(() => import('./components/AdventurePicker.jsx'));
const AdventureBuilder = lazy(() => import('./components/AdventureBuilder.jsx'));
const ShareDialog = lazy(() => import('./components/ShareDialog.jsx'));
const MapView = lazy(() => import('./components/MapView.jsx'));
const NpcGenerator = lazy(() => import('./components/NpcGenerator.jsx'));
const OverlandTravel = lazy(() => import('./components/OverlandTravel.jsx'));
const DungeonGenerator = lazy(() => import('./components/DungeonGenerator.jsx'));
const SettlementGenerator = lazy(() => import('./components/SettlementGenerator.jsx'));
const Bestiary = lazy(() => import('./components/Bestiary.jsx'));
const RandomTables = lazy(() => import('./components/RandomTables.jsx'));
const LootLedger = lazy(() => import('./components/LootLedger.jsx'));
const Graveyard = lazy(() => import('./components/Graveyard.jsx'));
const PowersPanel = lazy(() => import('./components/PowersPanel.jsx'));
const HelpCheatsheet = lazy(() => import('./components/HelpCheatsheet.jsx'));
const NodeSearch = lazy(() => import('./components/NodeSearch.jsx'));
const NodeHandout = lazy(() => import('./components/NodeHandout.jsx'));
const CrossRefSearch = lazy(() => import('./components/CrossRefSearch.jsx'));
const CampaignPanel = lazy(() => import('./components/CampaignPanel.jsx'));

const DEFAULT_ADVENTURE_ID = 'graves-left-wanting';

function AdventureRuntime({ adventure, ephemeral, onClearEphemeral, onChangeAdventure, onLoadEphemeral, playerMode, theme, onSetTheme, pendingJumpRef }) {
  const {
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
  } = useAdventure(adventure, { pendingJumpRef });

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
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [ambientOpen, setAmbientOpen] = useState(false);
  const [bestiaryOpen, setBestiaryOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [lootOpen, setLootOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [powersOpen, setPowersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [handoutOpen, setHandoutOpen] = useState(false);
  const [crossRefOpen, setCrossRefOpen] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

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
      setCombat({ active: true, round: 1, combatants, initiative: rollSideInitiative() });
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
      const isLocked = exit.locked && !state.unlockedExits.includes(exit.id);
      if (isLocked && exit.condition) {
        const proceed = window.confirm(
          `This exit is locked:\n\n  ${exit.condition}\n\nProceed anyway? (Use the 🔒 on the exit to unlock it permanently.)`
        );
        if (!proceed) return;
      }
      goToNode(exit.target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [goToNode, state.unlockedExits]
  );

  // Keyboard shortcuts. The listener is attached once and reads current panel
  // state through a ref so panel toggles don't churn the global keydown
  // subscription.
  const kbdRef = useRef(null);
  // Write the ref AFTER commit so we don't mutate during render — concurrent
  // / discarded renders would otherwise leave the ref pointing at stale state.
  // No deps array → runs after every commit, so the keydown listener always
  // reads the latest committed setters and panel state.
  useEffect(() => {
    kbdRef.current = {
      historyLen: state.history.length,
      goBack,
      dungeonOpen, settlementOpen, builderOpen, pickerOpen, shareOpen, mapOpen,
      rulesOpen, miseryOpen, diceOpen, npcOpen, combatOpen, travelOpen,
      ambientOpen, bestiaryOpen, tablesOpen, partyOpen,
      lootOpen, graveyardOpen, powersOpen, helpOpen, searchOpen, handoutOpen,
      crossRefOpen, campaignsOpen, resetDialogOpen,
      setDungeonOpen, setSettlementOpen, setBuilderOpen, setPickerOpen,
      setShareOpen, setMapOpen, setRulesOpen, setMiseryOpen, setDiceOpen,
      setNpcOpen, setCombatOpen, setTravelOpen, setAmbientOpen, setBestiaryOpen,
      setTablesOpen, setPartyOpen,
      setLootOpen, setGraveyardOpen, setPowersOpen, setHelpOpen, setSearchOpen,
      setHandoutOpen, setCrossRefOpen, setCampaignsOpen, setResetDialogOpen,
    };
  });
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const isFormElement =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      // ? always requires Shift on US layouts; let it through. Everything else
      // bails on any modifier so capitalised typing outside form fields doesn't
      // toggle panels.
      const isQuestion = e.key === '?';
      if (e.metaKey || e.ctrlKey || e.altKey || (e.shiftKey && !isQuestion)) return;

      const k = kbdRef.current;
      if (!k) return; // ref-assign effect hasn't run yet (first paint)

      // Escape closes the topmost panel, and must work even when a form element
      // has focus — otherwise the user is trapped.
      if (e.key === 'Escape') {
        if (k.resetDialogOpen) k.setResetDialogOpen(false);
        else if (k.helpOpen) k.setHelpOpen(false);
        else if (k.handoutOpen) k.setHandoutOpen(false);
        else if (k.searchOpen) k.setSearchOpen(false);
        else if (k.crossRefOpen) k.setCrossRefOpen(false);
        else if (k.campaignsOpen) k.setCampaignsOpen(false);
        else if (k.powersOpen) k.setPowersOpen(false);
        else if (k.graveyardOpen) k.setGraveyardOpen(false);
        else if (k.lootOpen) k.setLootOpen(false);
        else if (k.dungeonOpen) k.setDungeonOpen(false);
        else if (k.settlementOpen) k.setSettlementOpen(false);
        else if (k.builderOpen) k.setBuilderOpen(false);
        else if (k.pickerOpen) k.setPickerOpen(false);
        else if (k.shareOpen) k.setShareOpen(false);
        else if (k.mapOpen) k.setMapOpen(false);
        else if (k.rulesOpen) k.setRulesOpen(false);
        else if (k.miseryOpen) k.setMiseryOpen(false);
        else if (k.diceOpen) k.setDiceOpen(false);
        else if (k.npcOpen) k.setNpcOpen(false);
        else if (k.combatOpen) k.setCombatOpen(false);
        else if (k.travelOpen) k.setTravelOpen(false);
        else if (k.ambientOpen) k.setAmbientOpen(false);
        else if (k.bestiaryOpen) k.setBestiaryOpen(false);
        else if (k.tablesOpen) k.setTablesOpen(false);
        else if (k.partyOpen) k.setPartyOpen(false);
        return;
      }

      if (isFormElement) return;

      switch (e.key.toLowerCase()) {
        case '?': k.setRulesOpen((o) => !o); break;
        case 'b': if (k.historyLen > 1) k.goBack(); break;
        case 'p': k.setPartyOpen((o) => !o); break;
        case 'd': k.setDiceOpen((o) => !o); break;
        case 'm': k.setMapOpen((o) => !o); break;
        case 'k': k.setMiseryOpen((o) => !o); break;
        case 'l': k.setPickerOpen((o) => !o); break;
        case 's': k.setShareOpen((o) => !o); break;
        case 'n': k.setNpcOpen((o) => !o); break;
        case 'c': k.setCombatOpen((o) => !o); break;
        case 't': k.setTravelOpen((o) => !o); break;
        case 'a': k.setAmbientOpen((o) => !o); break;
        case 'e': k.setBestiaryOpen((o) => !o); break;
        case 'r': k.setTablesOpen((o) => !o); break;
        case 'g': k.setSettlementOpen((o) => !o); break;
        case 'h': k.setHelpOpen((o) => !o); break;
        case 'f': k.setSearchOpen((o) => !o); break;
        case 'o': k.setLootOpen((o) => !o); break;
        case 'v': k.setGraveyardOpen((o) => !o); break;
        case 'i': k.setPowersOpen((o) => !o); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          {/* In player mode, strip the toolbar to the few buttons the players
              should be touching: back, map, party (HP). The GM keeps the full
              bar in the GM window. */}
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
          {!playerMode && (
            <>
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
            </>
          )}
          <button
            type="button"
            className="iconbtn"
            onClick={() => setPartyOpen((o) => !o)}
            title="Party tracker (P)"
            aria-pressed={partyOpen}
          >
            ⚐ party
          </button>
          {!playerMode && (<>
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
            onClick={() => setSettlementOpen((o) => !o)}
            title="Generate a settlement (G)"
            aria-pressed={settlementOpen}
          >
            ⌂ town
          </button>
          <button type="button" className="iconbtn" onClick={() => setSearchOpen((o) => !o)} title="Find in adventure (F)" aria-pressed={searchOpen}>
            ⌕ find
          </button>
          <button type="button" className="iconbtn" onClick={() => setCrossRefOpen((o) => !o)} title="Search every adventure" aria-pressed={crossRefOpen}>
            ⌕⌖ across
          </button>
          <button type="button" className="iconbtn" onClick={() => setLootOpen((o) => !o)} title="Loot ledger (O)" aria-pressed={lootOpen}>
            ◈ loot
          </button>
          <button type="button" className="iconbtn" onClick={() => setGraveyardOpen((o) => !o)} title="The Graveyard (V)" aria-pressed={graveyardOpen}>
            ⚰ graveyard
          </button>
          <button type="button" className="iconbtn" onClick={() => setPowersOpen((o) => !o)} title="Powers & Catastrophes (I)" aria-pressed={powersOpen}>
            ✦ powers
          </button>
          <button type="button" className="iconbtn" onClick={() => setCampaignsOpen((o) => !o)} title="Campaigns" aria-pressed={campaignsOpen}>
            ☉ campaigns
          </button>
          <button type="button" className="iconbtn" onClick={() => setHelpOpen((o) => !o)} title="Help / cheatsheet (H)" aria-pressed={helpOpen}>
            ? help
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
            onClick={() => setResetDialogOpen(true)}
            title="Reset session"
          >
            ⟲ reset
          </button>
          </>)}
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
        onOpenMap={() => setMapOpen(true)}
        bookmarks={state.bookmarks ?? []}
      />

      <NodeView
        adventure={adventure}
        node={currentNode}
        visited={visited}
        unlockedExits={state.unlockedExits}
        onExit={handleExit}
        onUnlockExit={unlockExit}
        scratchNotes={currentNode ? state.gmNotesScratch?.[currentNode.id] ?? '' : ''}
        onScratchChange={
          currentNode ? (text) => setScratchNotes(currentNode.id, text) : undefined
        }
        onStartCombat={handleStartCombat}
        bookmarks={state.bookmarks ?? []}
        onToggleBookmark={toggleBookmark}
        onOpenHandout={() => setHandoutOpen(true)}
        onSaveFlavor={
          currentNode
            ? (beat) => appendScratchNotes(currentNode.id, `[flavor] ${beat}`)
            : undefined
        }
        playerMode={!!playerMode}
      />

      {partyOpen && (
        <PartyTracker
          party={state.partyState}
          onUpdate={updateParty}
          onDismiss={() => setPartyOpen(false)}
          onBury={buryMember}
        />
      )}

      <Suspense fallback={null}>
        {lootOpen && (
          <LootLedger
            open={lootOpen}
            onClose={() => setLootOpen(false)}
            loot={state.loot ?? { silver: 0, items: [] }}
            onUpdate={updateLoot}
            party={state.partyState}
          />
        )}
        {graveyardOpen && (
          <Graveyard
            open={graveyardOpen}
            onClose={() => setGraveyardOpen(false)}
            graveyard={state.graveyard ?? []}
            onExhume={exhumeMember}
          />
        )}
        {powersOpen && (
          <PowersPanel
            open={powersOpen}
            onClose={() => setPowersOpen(false)}
            canAddToNotes={!!currentNode}
            onAddToNotes={(text) => {
              if (currentNode) appendScratchNotes(currentNode.id, text);
            }}
          />
        )}
        {helpOpen && (
          <HelpCheatsheet open={helpOpen} onClose={() => setHelpOpen(false)} theme={theme} onSetTheme={onSetTheme} />
        )}
        {searchOpen && (
          <NodeSearch
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            adventure={adventure}
            onJump={(id) => {
              goToNode(id);
              setSearchOpen(false);
            }}
          />
        )}
        {handoutOpen && (
          <NodeHandout
            open={handoutOpen}
            onClose={() => setHandoutOpen(false)}
            node={currentNode}
            adventureTitle={adventure?.meta?.title || ''}
          />
        )}
        {crossRefOpen && (
          <CrossRefSearch
            open={crossRefOpen}
            onClose={() => setCrossRefOpen(false)}
            onLoad={(advId, nodeId) => {
              // Same adventure as currently loaded → direct jump, no swap.
              if (advId === getAdventureId(adventure)) {
                if (nodeId) goToNode(nodeId);
              } else {
                // Different adventure → stage the jump via pendingJumpRef so the
                // new useAdventure session starts on that node, not startNode.
                onChangeAdventure(advId, undefined, nodeId);
              }
            }}
          />
        )}
        {campaignsOpen && (
          <CampaignPanel
            open={campaignsOpen}
            onClose={() => setCampaignsOpen(false)}
            party={state.partyState}
            loot={state.loot}
            graveyard={state.graveyard}
          />
        )}
      </Suspense>

      {resetDialogOpen && (
        <div className="picker-overlay" role="dialog" aria-modal="true" onClick={() => setResetDialogOpen(false)}>
          <div className="picker picker--narrow" onClick={(e) => e.stopPropagation()}>
            <header className="picker__header">
              <h2>RESET</h2>
              <button type="button" className="iconbtn" onClick={() => setResetDialogOpen(false)}>✕</button>
            </header>
            <ResetForm
              onClose={() => setResetDialogOpen(false)}
              onReset={(opts) => {
                reset(opts);
                setResetDialogOpen(false);
              }}
            />
          </div>
        </div>
      )}

      <DiceTray
        open={diceOpen}
        onClose={() => setDiceOpen(false)}
        canAddToNotes={!!currentNode}
        onAddToNotes={(text) => {
          if (currentNode) appendScratchNotes(currentNode.id, text);
        }}
      />
      <MiseryTracker open={miseryOpen} onClose={() => setMiseryOpen(false)} />
      <Suspense fallback={null}>
        {npcOpen && (
          <NpcGenerator
            open={npcOpen}
            onClose={() => setNpcOpen(false)}
            canAddToNotes={!!currentNode}
            onAddToNotes={(text) => {
              if (currentNode) appendScratchNotes(currentNode.id, text);
            }}
          />
        )}
        {travelOpen && (
          <OverlandTravel
            open={travelOpen}
            onClose={() => setTravelOpen(false)}
            travelLog={state.travelLog ?? []}
            appendEntry={appendTravelEntry}
            updateEntry={updateTravelEntry}
            clearLog={clearTravelLog}
          />
        )}
        {bestiaryOpen && (
          <Bestiary
            open={bestiaryOpen}
            onClose={() => setBestiaryOpen(false)}
            canAddToNotes={!!currentNode}
            onAddToNotes={(text) => {
              if (currentNode) appendScratchNotes(currentNode.id, text);
            }}
          />
        )}
        {tablesOpen && (
          <RandomTables
            open={tablesOpen}
            onClose={() => setTablesOpen(false)}
            canAddToNotes={!!currentNode}
            onAddToNotes={(text) => {
              if (currentNode) appendScratchNotes(currentNode.id, text);
            }}
          />
        )}
      </Suspense>
      <CombatTracker
        open={combatOpen}
        onClose={() => setCombatOpen(false)}
        combatState={state.combatState ?? { active: false, round: 0, combatants: [] }}
        setCombat={setCombat}
        endCombat={handleEndCombat}
      />
      <AmbientMixer open={ambientOpen} onClose={() => setAmbientOpen(false)} />

      <Suspense fallback={null}>
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

        {dungeonOpen && (
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
              onLoadEphemeral(generatedAdventure);
            }}
          />
        )}

        {settlementOpen && (
          <SettlementGenerator
            open={settlementOpen}
            onClose={() => setSettlementOpen(false)}
            onRun={(generatedAdventure) => {
              const v = validateAdventure(generatedAdventure);
              if (!v.ok) {
                window.alert(`Generated settlement is malformed: ${v.errors.join(' · ')}`);
                return;
              }
              setSettlementOpen(false);
              onLoadEphemeral(generatedAdventure);
            }}
          />
        )}

        {shareOpen && (
          <ShareDialog adventure={adventure} onClose={() => setShareOpen(false)} />
        )}
      </Suspense>

      <RulesPanel rules={rules} open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <footer className="app-foot">
        <small>{adventure.meta.license}</small>
        <small className="app-foot__keys">
          shortcuts: ? rules · b back · l library · m map · d dice · k calendar · p party · n npc · c combat · t travel · a ambient · e bestiary · r tables · g town · o loot · v graveyard · i powers · f find · h help · s share · esc close
        </small>
      </footer>
    </>
  );
}

// Granular reset dialog — replaces the old all-or-nothing confirm.
function ResetForm({ onClose, onReset }) {
  const [opts, setOpts] = useState({
    history: true,
    party: false,
    combat: true,
    travel: false,
    scratchNotes: false,
    bookmarks: false,
    loot: false,
    graveyard: false,
  });
  const toggle = (k) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  return (
    <section className="picker__section reset-form">
      <p>Pick what to wipe. Leave a slice unchecked to keep it.</p>
      <ul className="reset-form__list">
        {[
          ['history', 'Navigation & visited nodes (reset to start)'],
          ['party', 'Party tracker (PCs, omens, deaths counter)'],
          ['combat', 'Combat tracker'],
          ['travel', 'Overland travel log'],
          ['scratchNotes', "GM notes scratchpad (per-node)"],
          ['bookmarks', 'Node bookmarks'],
          ['loot', 'Loot ledger'],
          ['graveyard', 'The Graveyard (dead PCs)'],
        ].map(([key, label]) => (
          <li key={key}>
            <label>
              <input type="checkbox" checked={opts[key]} onChange={() => toggle(key)} />
              {label}
            </label>
          </li>
        ))}
      </ul>
      <footer className="reset-form__foot">
        <button type="button" className="iconbtn" onClick={onClose}>cancel</button>
        <button
          type="button"
          className="iconbtn iconbtn--danger"
          onClick={() => onReset(opts)}
          disabled={!Object.values(opts).some(Boolean)}
        >
          ⟲ wipe selected
        </button>
      </footer>
    </section>
  );
}

// `?player=1` puts the runner in player-handout mode: hide GM notes and
// unrevealed secrets, strip the toolbar to back/map/party-HP.
function isPlayerMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('player') === '1';
  } catch {
    return false;
  }
}

// Theme variants — persisted to localStorage and applied as classes on <body>.
const THEME_KEY = 'mb-theme';
function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return { highContrast: false, largeText: false };
    const t = JSON.parse(raw);
    return {
      highContrast: !!t?.highContrast,
      largeText: !!t?.largeText,
    };
  } catch {
    return { highContrast: false, largeText: false };
  }
}
function saveTheme(t) {
  try { localStorage.setItem(THEME_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

export default function App() {
  const [adventure, setAdventure] = useState(null);
  const [ephemeral, setEphemeral] = useState(false);
  const [shareLoadError, setShareLoadError] = useState(null);
  const [theme, setTheme] = useState(loadTheme);
  const playerMode = useMemo(() => isPlayerMode(), []);

  // Apply + persist theme variant classes on body.
  useEffect(() => {
    document.body.classList.toggle('theme-high-contrast', theme.highContrast);
    document.body.classList.toggle('theme-large-text', theme.largeText);
    saveTheme(theme);
  }, [theme]);

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
            // Clear the broken hash so a reload doesn't re-trigger the failure.
            clearShareFromLocation();
          } else {
            if (cancelled) return;
            setAdventure(decoded);
            setEphemeral(true);
            clearShareFromLocation();
            return;
          }
        } catch (e) {
          setShareLoadError(`Could not load share link: ${e.message}`);
          clearShareFromLocation();
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
        // Stale pointer to a deleted user adventure / unknown id — clear it so
        // we don't keep falling through to the default forever.
        setLastLoaded(DEFAULT_ADVENTURE_ID);
      }

      if (!cancelled) setAdventure(getBundledAdventure(DEFAULT_ADVENTURE_ID));
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Staged jump for cross-reference searches. When set, useAdventure consumes
  // it on next adventure switch so the runner lands on that node instead of
  // bouncing through startNode first.
  const pendingJumpRef = useRef(null);

  const handleChangeAdventure = useCallback((id, advObject, jumpToNodeId) => {
    let next = advObject;
    if (!next) {
      next = isBundled(id) ? getBundledAdventure(id) : getUserAdventure(id);
    }
    if (!next) {
      window.alert(`Adventure "${id}" not found.`);
      return;
    }
    pendingJumpRef.current = jumpToNodeId || null;
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
          playerMode={playerMode}
          theme={theme}
          onSetTheme={setTheme}
          pendingJumpRef={pendingJumpRef}
        />
      ) : (
        <div className="loading">
          <p>Reading the will of the dying world…</p>
        </div>
      )}
    </div>
  );
}
