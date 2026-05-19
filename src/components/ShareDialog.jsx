import { useEffect, useState } from 'react';
import { encodeAdventureToHash, buildShareUrl } from '../utils/share.js';

export default function ShareDialog({ adventure, onClose }) {
  const [url, setUrl] = useState(null);
  const [size, setSize] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const payload = await encodeAdventureToHash(adventure);
        const link = buildShareUrl(payload);
        if (cancelled) return;
        setUrl(link);
        setSize(link.length);
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
      }
    }
    generate();
    return () => {
      cancelled = true;
    };
  }, [adventure]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select text
      const el = document.getElementById('share-url-field');
      el?.select();
      document.execCommand?.('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(adventure, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${adventure.meta.id || 'adventure'}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const sizeWarning = size && size > 2000;

  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="picker picker--narrow"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="picker__header">
          <h2>SHARE THIS ADVENTURE</h2>
          <button type="button" className="iconbtn" onClick={onClose}>
            ✕
          </button>
        </header>

        <section className="picker__section">
          <h3>SHAREABLE LINK</h3>
          <p className="picker__desc">
            Anyone who opens this link in the runner loads the full adventure
            from the URL. No server involved — the JSON is gzipped into the
            hash.
          </p>

          {error && <p className="picker__upload-error">⚠ {error}</p>}

          {url && (
            <>
              <textarea
                id="share-url-field"
                readOnly
                className="share-field"
                value={url}
                rows={4}
                onFocus={(e) => e.target.select()}
              />
              <div className="share-actions">
                <button type="button" className="iconbtn iconbtn--rules" onClick={copy}>
                  {copied ? '✓ copied' : '⧉ copy link'}
                </button>
                <span className="share-size">
                  {size.toLocaleString()} chars
                  {sizeWarning && (
                    <span title="Some browsers and chat apps truncate very long URLs."> ⚠</span>
                  )}
                </span>
              </div>
            </>
          )}
        </section>

        <section className="picker__section">
          <h3>OR DOWNLOAD .JSON</h3>
          <p className="picker__desc">
            Save the adventure file to share by other means (email, repo,
            community submission). Recipients open it via the Library →
            Upload.
          </p>
          <button type="button" className="iconbtn" onClick={download}>
            ⤓ download {adventure.meta.id || 'adventure'}.json
          </button>
        </section>
      </div>
    </div>
  );
}
