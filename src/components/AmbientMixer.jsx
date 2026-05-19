import { useEffect, useState } from 'react';
import { listChannels, CHANNEL_LABELS, setChannelLevel, stopAll, ensureContext } from '../utils/audio.js';

const STORAGE_KEY = 'mb-ambient-mix';

function loadMix() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveMix(mix) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mix));
  } catch {
    /* quota or privacy mode */
  }
}

export default function AmbientMixer({ open, onClose }) {
  const channels = listChannels();
  const [levels, setLevels] = useState(() => {
    const saved = loadMix();
    const init = {};
    for (const c of channels) init[c] = saved?.[c] ?? 0;
    return init;
  });
  const [masterOn, setMasterOn] = useState(false);

  // Persist mix whenever it changes. Do NOT auto-resume on mount — browsers
  // require a user gesture; the user re-engages master each session.
  useEffect(() => {
    saveMix(levels);
  }, [levels]);

  // Apply levels when master is on; mute everything when off.
  useEffect(() => {
    if (!masterOn) {
      stopAll();
      return;
    }
    ensureContext();
    for (const c of channels) setChannelLevel(c, levels[c] ?? 0);
  }, [masterOn, levels, channels]);

  // Stop audio on unmount so navigating away doesn't leave sound running.
  useEffect(() => {
    return () => stopAll();
  }, []);

  if (!open) return null;

  const setLevel = (channel, value) => {
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    setLevels((m) => ({ ...m, [channel]: v }));
  };

  const allOff = () => {
    setLevels((m) => {
      const next = { ...m };
      for (const c of channels) next[c] = 0;
      return next;
    });
    setMasterOn(false);
  };

  return (
    <aside className="ambient-mixer" role="dialog" aria-label="Ambient sound mixer">
      <header className="ambient-mixer__header">
        <h3>AMBIENT</h3>
        <div className="ambient-mixer__head-actions">
          <button
            type="button"
            className={`iconbtn ${masterOn ? 'iconbtn--rules' : ''}`}
            onClick={() => setMasterOn((o) => !o)}
            aria-pressed={masterOn}
            title={masterOn ? 'Mute master output' : 'Engage master output'}
          >
            {masterOn ? '◉ on' : '○ off'}
          </button>
          <button type="button" className="iconbtn" onClick={allOff} title="Reset all to zero">⟲ reset</button>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      <p className="ambient-mixer__hint">
        Web Audio synthesis — no files. Engage master first; the browser blocks audio until you do.
      </p>

      <ul className="ambient-mixer__channels">
        {channels.map((c) => (
          <li key={c} className="ambient-channel">
            <span className="ambient-channel__label">{CHANNEL_LABELS[c]}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={levels[c] ?? 0}
              onChange={(e) => setLevel(c, e.target.value)}
              className="ambient-channel__slider"
              aria-label={`${CHANNEL_LABELS[c]} volume`}
            />
            <span className="ambient-channel__value">{Math.round((levels[c] ?? 0) * 100)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
