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
// partyState + Graveyard + Loot across adventures. When one is "active," the
// runner mirrors party/loot/graveyard between session state and the campaign.

export default function CampaignPanel({ open, onClose, party, loot, graveyard }) {
  const [refresh, force] = useState(0);
  const reload = () => force((n) => n + 1);
  const [newName, setNewName] = useState('');

  if (!open) return null;

  const campaigns = listCampaigns();
  const activeId = getActiveCampaignId();

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const c = createCampaign(name, party);
    setNewName('');
    setActiveCampaignId(c.id);
    reload();
  };

  const setActive = (id) => {
    setActiveCampaignId(activeId === id ? null : id);
    reload();
  };

  const snapshot = (id) => {
    updateCampaign(id, { partyState: party, graveyard: graveyard ?? [], loot: loot ?? { silver: 0, items: [] } });
    reload();
  };

  const remove = (id) => {
    const c = campaigns.find((x) => x.id === id);
    if (!window.confirm(`Delete campaign "${c?.name}"? Its party, loot and graveyard are gone with it.`)) return;
    deleteCampaign(id);
    reload();
  };

  return (
    <aside className="campaign-panel" role="dialog" aria-label="Campaigns" data-refresh={refresh}>
      <header className="campaign-panel__header">
        <h3>CAMPAIGNS</h3>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
      </header>

      <p className="campaign-panel__hint">
        A campaign holds a shared party, graveyard, and loot ledger across adventures.
        Snapshot the current state into a campaign, or activate a campaign to mark
        which one this session belongs to.
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
              <span className="campaign__name">{c.name}</span>
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
