// Client-side ad fetcher with a small in-memory cache. The /api/ads endpoint
// returns ads grouped by placement; we re-fetch every 60s. Components subscribe
// via getAds(placement) — when data arrives the listener is called again.

export interface Ad {
  id: string;
  name: string;
  placement: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  htmlSnippet?: string | null;
  altText?: string | null;
  weight?: number;
}

type Listener = () => void;

let cache: Record<string, Ad[]> = {};
let lastFetch = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<Listener>();

const TTL_MS = 60_000;

async function refresh(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/ads');
      if (!res.ok) return;
      const data = await res.json();
      cache = data.ads ?? {};
      lastFetch = Date.now();
      listeners.forEach(l => l());
    } catch {
      /* swallow — ad failures must never break the app */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function getAds(placement: string): Ad[] {
  if (Date.now() - lastFetch > TTL_MS) refresh();
  return cache[placement] ?? [];
}

export function subscribeAds(fn: Listener): () => void {
  listeners.add(fn);
  if (Date.now() - lastFetch > TTL_MS) refresh();
  return () => { listeners.delete(fn); };
}

export function trackAd(id: string, kind: 'impression' | 'click'): void {
  // Fire-and-forget — uses sendBeacon when available for clicks (page may unload).
  try {
    const body = JSON.stringify({ kind });
    if (kind === 'click' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(`/api/ads/${id}/track`, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(`/api/ads/${id}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

export function pickWeighted(ads: Ad[]): Ad | null {
  if (!ads.length) return null;
  const total = ads.reduce((s, a) => s + Math.max(0, a.weight ?? 1), 0);
  if (total <= 0) return ads[0];
  let r = Math.random() * total;
  for (const a of ads) {
    r -= Math.max(0, a.weight ?? 1);
    if (r <= 0) return a;
  }
  return ads[ads.length - 1];
}
