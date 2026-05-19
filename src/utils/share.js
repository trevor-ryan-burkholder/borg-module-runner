// Encode/decode an adventure JSON into a URL hash payload.
// Uses CompressionStream (gzip) when available, falls back to plain base64.
// The hash format is: #adv=<base64url-payload>
//
// Payload prefix: 'g' for gzipped, 'p' for plain. The decoder reads the prefix.

const HASH_KEY = 'adv';

function base64UrlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function gzip(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

async function gunzip(bytes) {
  if (typeof DecompressionStream === 'undefined') return null;
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const decompressed = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(decompressed);
}

export async function encodeAdventureToHash(adventure) {
  const json = JSON.stringify(adventure);
  const bytes = new TextEncoder().encode(json);

  const compressed = await gzip(bytes);
  if (compressed) {
    return `g${base64UrlEncode(compressed)}`;
  }
  return `p${base64UrlEncode(bytes)}`;
}

export async function decodeAdventureFromHashPayload(payload) {
  if (!payload || payload.length < 2) throw new Error('Empty share payload.');
  const prefix = payload[0];
  const body = payload.slice(1);
  const bytes = base64UrlDecode(body);

  let raw;
  if (prefix === 'g') {
    const decompressed = await gunzip(bytes);
    if (!decompressed) {
      throw new Error('This browser cannot decompress gzipped share links.');
    }
    raw = new TextDecoder().decode(decompressed);
  } else if (prefix === 'p') {
    raw = new TextDecoder().decode(bytes);
  } else {
    throw new Error('Unknown share payload format.');
  }

  return JSON.parse(raw);
}

export function readShareFromLocation() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const payload = params.get(HASH_KEY);
  return payload || null;
}

export function buildShareUrl(payload) {
  const params = new URLSearchParams();
  params.set(HASH_KEY, payload);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function clearShareFromLocation() {
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
