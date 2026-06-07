// User-uploaded adventures persisted in localStorage.
// Bundled adventures live in src/data/ and are imported statically.

const LIBRARY_KEY = 'mb-module-runner-library';
const LAST_LOADED_KEY = 'mb-module-runner-last-loaded';

function read() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(store) {
  // Surface quota / privacy-mode errors to the caller so the UI can react
  // (saveUserAdventure callers all have try/catch around them).
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(store));
}

export function listUserAdventures() {
  const store = read();
  return Object.values(store).sort((a, b) =>
    (a.meta?.title || '').localeCompare(b.meta?.title || '')
  );
}

export function getUserAdventure(id) {
  const store = read();
  return store[id] || null;
}

export function saveUserAdventure(adventure) {
  const id = adventure?.meta?.id;
  if (!id) throw new Error('Cannot save: adventure.meta.id is required.');
  const store = read();
  store[id] = adventure;
  write(store);
  return id;
}

export function deleteUserAdventure(id) {
  const store = read();
  delete store[id];
  write(store);
  // Also clear the per-adventure session blobs so deleting a library entry
  // doesn't leave orphan state behind, slowly bloating localStorage.
  try {
    localStorage.removeItem(`mb-module-runner-state:${id}`);
    localStorage.removeItem(`mb-module-runner-scratch:${id}`);
  } catch {
    /* ignore */
  }
}

export function setLastLoaded(id) {
  try {
    localStorage.setItem(LAST_LOADED_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getLastLoaded() {
  try {
    return localStorage.getItem(LAST_LOADED_KEY);
  } catch {
    return null;
  }
}
