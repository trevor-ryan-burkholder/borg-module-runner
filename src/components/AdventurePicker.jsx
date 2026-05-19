import { useRef, useState } from 'react';
import { listBundledAdventures, getBundledAdventure } from '../utils/loadAdventure.js';
import {
  listUserAdventures,
  saveUserAdventure,
  deleteUserAdventure,
} from '../utils/library.js';
import { validateAdventure, getAdventureId, slugify } from '../utils/validate.js';

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function AdventurePicker({ onPick, onOpenBuilder, onClose }) {
  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadWarnings, setUploadWarnings] = useState([]);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  const bundled = listBundledAdventures();
  const userAdventures = listUserAdventures();

  const handleFiles = async (files) => {
    setUploadError(null);
    setUploadWarnings([]);
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const text = await readFileAsText(file);
      const json = JSON.parse(text);
      const result = validateAdventure(json);
      if (!result.ok) {
        setUploadError(result.errors.join(' · '));
        return;
      }
      // Ensure meta.id is set.
      if (!json.meta.id) {
        json.meta.id = slugify(json.meta.title);
      }
      const id = saveUserAdventure(json);
      setUploadWarnings(result.warnings);
      refresh();
      onPick({ source: 'user', id, adventure: json });
    } catch (err) {
      setUploadError(`Could not load file: ${err.message}`);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const pickBundled = (entry) => {
    const adv = getBundledAdventure(entry.id);
    if (adv) onPick({ source: 'bundled', id: entry.id, adventure: adv });
  };

  const pickUser = (adv) => {
    onPick({ source: 'user', id: getAdventureId(adv), adventure: adv });
  };

  const removeUser = (adv) => {
    if (!window.confirm(`Delete "${adv.meta.title}" from your library? This cannot be undone.`)) return;
    deleteUserAdventure(getAdventureId(adv));
    refresh();
  };

  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" aria-label="Choose adventure">
      <div className="picker" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <header className="picker__header">
          <h2>THE LIBRARY</h2>
          {onClose && (
            <button type="button" className="iconbtn" onClick={onClose} title="Close">
              ✕
            </button>
          )}
        </header>

        <section className="picker__section">
          <h3>BUNDLED</h3>
          <ul className="picker__list">
            {bundled.map((entry) => (
              <li key={entry.id} className="picker__entry">
                <button
                  type="button"
                  className="picker__entry-main"
                  onClick={() => pickBundled(entry)}
                >
                  <div className="picker__entry-title">{entry.title}</div>
                  <div className="picker__entry-meta">
                    <span className={`tag tag--system tag--system-${entry.system}`}>
                      {entry.system}
                    </span>
                    <span className="picker__entry-author">{entry.author}</span>
                  </div>
                  <div className="picker__entry-desc">{entry.description}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="picker__section">
          <h3>YOUR LIBRARY ({userAdventures.length})</h3>
          {userAdventures.length === 0 ? (
            <p className="empty">Nothing uploaded yet. Drop a .json file anywhere on this panel.</p>
          ) : (
            <ul className="picker__list">
              {userAdventures.map((adv) => (
                <li key={getAdventureId(adv)} className="picker__entry">
                  <button
                    type="button"
                    className="picker__entry-main"
                    onClick={() => pickUser(adv)}
                  >
                    <div className="picker__entry-title">{adv.meta.title}</div>
                    <div className="picker__entry-meta">
                      <span
                        className={`tag tag--system tag--system-${adv.meta.system || 'morkborg'}`}
                      >
                        {adv.meta.system || 'morkborg'}
                      </span>
                      {adv.meta.author && (
                        <span className="picker__entry-author">{adv.meta.author}</span>
                      )}
                    </div>
                    {adv.meta.description && (
                      <div className="picker__entry-desc">{adv.meta.description}</div>
                    )}
                  </button>
                  <div className="picker__entry-actions">
                    <button
                      type="button"
                      className="iconbtn iconbtn--danger"
                      onClick={() => removeUser(adv)}
                      title="Delete from library"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="picker__upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            className="iconbtn"
            onClick={() => fileInputRef.current?.click()}
          >
            ⤓ upload .json
          </button>
          {onOpenBuilder && (
            <button type="button" className="iconbtn" onClick={onOpenBuilder}>
              ✎ new in builder
            </button>
          )}
          <span className="picker__upload-hint">or drop a file anywhere on this panel</span>

          {uploadError && (
            <p className="picker__upload-error">⚠ {uploadError}</p>
          )}
          {uploadWarnings.length > 0 && (
            <ul className="picker__upload-warnings">
              {uploadWarnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
