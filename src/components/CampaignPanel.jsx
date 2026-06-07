import { useState } from 'react';
import {
  listCampaigns,
  createCampaign,
  deleteCampaign,
  setActiveCampaignId,
  getActiveCampaignId,
  updateCampaign,
} from '../utils/campaigns.js';

// Lightweight campaign manager: a campaign is a named scope that carries
// partyState + Graveyard + Loot across adventures. While one is active,
// useAdventure overlays party/loot/graveyard from that campaign and mirrors
// changes back, so the same party rolls across every adventure you load.

export default function CampaignPanel({ open, onClose, party, loot, graveyard }) {
  // A counter we bump after writes to force a re-render with fresh
  // listCampaigns / getActiveCampaignId output.
  const [, force] = useState(0);
  const reload = () => force((n) => n + 1);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  if (!open) return null;

  const campaigns = listCampaigns();
  const activeId = getActiveCampaignId();

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const c = createCampaign(name, party);
      setNewName('');
      setActiveCampaignId(c.id);
      reload();
    } catch (err) {
      window.alert(`Could not save the campaign: ${err.message}`);
    }
  };

  const setActive = (id) => {
    setActiveCampaignId(activeId === id ? null : id);
    reload();
  };

  const snapshot = (id) => {
    try {
      updateCampaign(id, {
        partyState: party,
        graveyard: graveyard ?? [],
        loot: loot ?? { silver: 0, items: [] },
      });
      reload();
    } catch (err) {
      window.alert(`Could not save the snapshot: ${err.message}`);
    }
  };

  const remove = (id) => {
    const c = campaigns.find((x) => x.id === id);
    if (!window.confirm(`Delete campaign "${c?.name}"? Its party, loot and graveyard are gone with it.`)) return;
    deleteCampaign(id);
    reload();
  };

  const startRename = (c) => {
    setRenamingId(c.id);
    setRenameDraft(c.name);
  };

  const commitRename = () => {
    const name = renameDraft.trim();
    if (renamingId && name) {
      try {
        updateCampaign(renamingId, { name });
      } catch (err) {
        window.alert(`Could not rename: ${err.message}`);
      }
    }
    setRenamingId(null);
    setRenameDraft('');
    reload();
  };

  return (
    <aside className="campaign-panel" role="dialog" aria-label="Campaigns">
      <header className="campaign-panel__header">
        <h3>CAMPAIGNS</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <p className="campaign-panel__hint">
        A campaign carries a shared party, graveyard, and loot ledger across
        adventures. Activate one and your party rolls with you into the next
        module; snapshot to overwrite the campaign with the current session.
      </p>

      <div className="campaign-panel__create">
        <input
          type="text"
          placeholder="new campaign name (e.g. The Wettermark Hunt)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button type="button" className="iconbtn iconbtn--rules" onClick={create}>
          + new campaign
        </button>
      </div>

      <ul className="campaign-panel__list">
        {campaigns.length === 0 && (
          <li className="empty">No campaigns yet. Start one to carry the party between adventures.</li>
        )}
        {campaigns.map((c) => (
          <li key={c.id} className={`campaign ${activeId === c.id ? 'campaign--active' : ''}`}>
            <div className="campaign__meta">
              {renamingId === c.id ? (
                <input
                  className="campaign__name campaign__name--edit"
                  type="text"
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') { setRenamingId(null); setRenameDraft(''); }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="campaign__name"
                  onClick={() => startRename(c)}
                  title="Click to rename"
                >
                  {c.name}
                </button>
              )}
              <span className="campaign__stats">
                {(c.partyState?.members?.length ?? 0)} PCs · {(c.graveyard?.length ?? 0)} dead · {(c.loot?.items?.length ?? 0)} items
              </span>
            </div>
            <div className="campaign__actions">
              <button
                type="button"
                className={`iconbtn ${activeId === c.id ? 'iconbtn--rules' : ''}`}
                onClick={() => setActive(c.id)}
              >
                {activeId === c.id ? '◉ active' : 'activate'}
              </button>
              <button
                type="button"
                className="iconbtn"
                onClick={() => snapshot(c.id)}
                title="Save the current session's party / graveyard / loot into this campaign"
              >
                ⤓ snapshot
              </button>
              <button
                type="button"
                className="iconbtn iconbtn--danger"
                onClick={() => remove(c.id)}
                aria-label={`Delete campaign ${c.name}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
