// Campaign storage — a lightweight "carry party across adventures" layer kept
// entirely in localStorage. A campaign holds a shared partyState; when one is
// active, the runner pulls the party from the campaign instead of from
// per-adventure session storage and writes it back as it changes.

const CAMPAIGNS_KEY = 'mb-campaigns';
const ACTIVE_KEY = 'mb-campaign-active';

function read() {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(store) {
  // Surface quota errors to the caller; CampaignPanel + useAdventure both wrap
  // their updateCampaign() calls in try/catch.
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(store));
}

export function listCampaigns() {
  return Object.values(read()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getCampaign(id) {
  return read()[id] || null;
}

export function createCampaign(name, partyState) {
  const id = `camp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const camp = {
    id,
    name: String(name || 'Unnamed Campaign').trim() || 'Unnamed Campaign',
    createdAt: Date.now(),
    partyState: partyState || { members: [], omens: 3, deaths: 0 },
    graveyard: [],
    loot: { silver: 0, items: [] },
  };
  const store = read();
  store[id] = camp;
  write(store);
  return camp;
}

export function updateCampaign(id, patch) {
  const store = read();
  if (!store[id]) return null;
  store[id] = { ...store[id], ...patch };
  write(store);
  return store[id];
}

export function deleteCampaign(id) {
  const store = read();
  delete store[id];
  write(store);
  if (getActiveCampaignId() === id) setActiveCampaignId(null);
}

export function setActiveCampaignId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function getActiveCampaignId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}
