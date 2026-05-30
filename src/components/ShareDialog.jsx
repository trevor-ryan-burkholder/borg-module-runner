import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { encodeAdventureToHash, buildShareUrl, decodeAdventureFromHashPayload } from '../utils/share.js';
import { validateAdventure } from '../utils/validate.js';

export default function ShareDialog({ adventure, onClose }) {
  const [url, setUrl] = useState(null);
  const [payload, setPayload] = useState(null);
  const [size, setSize] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [roundTrip, setRoundTrip] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrError, setQrError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const p = await encodeAdventureToHash(adventure);
        const link = buildShareUrl(p);
        if (cancelled) return;
        setUrl(link);
        setPayload(p);
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

  // Regenerate QR code whenever the URL changes. QR has a hard char limit so
  // we tolerate failure gracefully and surface the reason.
  useEffect(() => {
    if (!url) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'L', margin: 1, width: 320 })
      .then((dataUrl) => {
        if (cancelled) return;
        setQrDataUrl(dataUrl);
        setQrError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setQrDataUrl(null);
        setQrError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

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
    a.download = `${adventure?.meta?.id || 'adventure'}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  // Decode the share payload back into an adventure and run it through the
  // same validator that loads consume — proves the link round-trips before
  // anyone has to actually open it in another tab.
  const testRoundTrip = async () => {
    if (!payload) return;
    try {
      const decoded = await decodeAdventureFromHashPayload(payload);
      const v = validateAdventure(decoded);
      if (!v.ok) {
        setRoundTrip({ ok: false, msg: `validation: ${v.errors.join(' · ')}` });
        return;
      }
      setRoundTrip({
        ok: true,
        msg: `${decoded.nodes?.length ?? 0} nodes · ${(v.warnings || []).length} warning${(v.warnings || []).length === 1 ? '' : 's'}`,
      });
    } catch (e) {
      setRoundTrip({ ok: false, msg: e.message });
    }
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
                <button type="button" className="iconbtn" onClick={testRoundTrip} title="Decode the link and validate it">
                  ⇄ test round-trip
                </button>
                <span className="share-size">
                  {size.toLocaleString()} chars
                  {sizeWarning && (
                    <span title="Some browsers and chat apps truncate very long URLs."> ⚠</span>
                  )}
                </span>
              </div>
              {roundTrip && (
                <p className={roundTrip.ok ? 'picker__upload-warnings' : 'picker__upload-error'}>
                  {roundTrip.ok ? '✓ round-trips: ' : '⚠ round-trip failed: '}
                  {roundTrip.msg}
                </p>
              )}

              {qrDataUrl && (
                <figure className="share-qr">
                  <img src={qrDataUrl} alt="QR code of the share link" />
                  <figcaption>Scan to open this adventure on another device.</figcaption>
                </figure>
              )}
              {qrError && (
                <p className="picker__upload-error">
                  QR unavailable for this link: {qrError}. Long share URLs exceed the QR capacity — use the link or the download.
                </p>
              )}
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
