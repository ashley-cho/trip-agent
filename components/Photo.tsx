"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A real photograph of the actual place, from Wikipedia.
 *
 * The naive version of this — full-text search, take the first result — is
 * confidently wrong in a way that would embarrass the whole product. Searching
 * "the Olympic Peninsula" returned the Upper Peninsula of Michigan. "Big Sur"
 * returned macOS Big Sur. "Baixa, Porto" returned a neighbourhood in Porto
 * Alegre, Brazil. A photograph of the wrong continent under a heading that
 * names the right one is a lie the page tells on its own.
 *
 * So every candidate is checked against coordinates we already hold for that
 * city or place. If the article isn't within a sane distance of where we're
 * actually sending someone, it isn't the article. When search finds nothing
 * that passes, geosearch asks the opposite question: what is photographed near
 * this point? That is how "the South Coast" of Iceland ends up as Skógafoss
 * rather than the Icelandic Coast Guard.
 *
 * Nothing is invented. If no candidate survives, the slot collapses.
 */

export interface Coord { lat: number; lng: number; }
interface Shot { src: string; page: string; title: string; }

const cache = new Map<string, Shot | null>();
const inflight = new Map<string, Promise<Shot | null>>();

const API = "https://en.wikipedia.org/w/api.php";

/** Great-circle km. The check is coarse on purpose; we're ruling out continents. */
function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s: string) =>
  s.toLowerCase().replace(/^the\s+/, "").normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

async function json(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function bySearch(query: string, name: string, near?: Coord): Promise<Shot | null> {
  const url = `${API}?action=query&format=json&origin=*&generator=search&gsrlimit=6`
    + `&gsrsearch=${encodeURIComponent(query)}`
    + `&prop=pageimages|coordinates|info&piprop=thumbnail&pithumbsize=1000&colimit=6&inprop=url`;
  const j = await json(url);
  const pages: any[] = j?.query?.pages ? Object.values(j.query.pages) : [];
  const want = norm(name);
  let best: { shot: Shot; score: number } | null = null;

  for (const p of pages) {
    if (!p.thumbnail?.source) continue;
    let distance = 0;
    if (near) {
      const co = p.coordinates?.[0];
      if (!co) continue;                       // unplaceable, so unverifiable
      distance = km(near.lat, near.lng, co.lat, co.lon);
      if (distance > 60) continue;
    }
    const t = norm(p.title);
    const nameScore =
      t === want ? 0
      : t.startsWith(want) || want.startsWith(t) ? 1
      : t.includes(want) ? 2
      : 3;
    // A page whose title has nothing to do with the name has to be right on
    // top of the place to be believable.
    if (nameScore === 3 && distance > 15) continue;
    const score = nameScore * 1000 + distance;
    if (!best || score < best.score) {
      best = { score, shot: { src: p.thumbnail.source, page: p.fullurl, title: p.title } };
    }
  }
  return best?.shot ?? null;
}

/** What is photographed near this point? Used when the name leads nowhere. */
async function byPlace(near: Coord): Promise<Shot | null> {
  const url = `${API}?action=query&format=json&origin=*&generator=geosearch`
    + `&ggscoord=${near.lat}%7C${near.lng}&ggsradius=10000&ggslimit=20`
    + `&prop=pageimages|coordinates|info&piprop=thumbnail&pithumbsize=1000&inprop=url`;
  const j = await json(url);
  const pages: any[] = (j?.query?.pages ? Object.values(j.query.pages) : [])
    .filter((p: any) => p.thumbnail?.source && p.coordinates?.[0]);
  if (!pages.length) return null;
  pages.sort((a, b) =>
    km(near.lat, near.lng, a.coordinates[0].lat, a.coordinates[0].lon)
    - km(near.lat, near.lng, b.coordinates[0].lat, b.coordinates[0].lon));
  const p = pages[0];
  return { src: p.thumbnail.source, page: p.fullurl, title: p.title };
}

async function lookup(queries: string[], near?: Coord): Promise<Shot | null> {
  const key = queries.join("|") + (near ? `@${near.lat},${near.lng}` : "");
  if (cache.has(key)) return cache.get(key)!;
  const running = inflight.get(key);
  if (running) return running;

  const p = (async () => {
    try {
      for (const q of queries) {
        // The bare name searches better than the name plus context: "Barcelona
        // Barcelona & the Costa Brava" doesn't return the article on Barcelona.
        const hit = await bySearch(q, queries[0], near);
        if (hit) return hit;
      }
      return near ? await byPlace(near) : null;
    } catch {
      return null;
    }
  })().then((shot) => { cache.set(key, shot); inflight.delete(key); return shot; });

  inflight.set(key, p);
  return p;
}

export function Photo({
  query, near, alt, className = "", ratio = "16 / 9", rounded = "rounded-none",
}: {
  /** The name first, then progressively broader fallbacks. */
  query: string | string[];
  /** Where it actually is. Without this, nothing is verified. */
  near?: Coord;
  alt: string;
  className?: string;
  ratio?: string;
  rounded?: string;
}) {
  const queries = Array.isArray(query) ? query : [query];
  const key = queries.join("|");
  const [shot, setShot] = useState<Shot | null | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    setLoaded(false);
    lookup(queries, near).then((s) => { if (live.current) setShot(s); });
    return () => { live.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, near?.lat, near?.lng]);

  if (shot === null) return null;

  return (
    <figure
      className={`group relative overflow-hidden bg-paper-blank ${rounded} ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {shot && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.src}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setShot(null)}
            className={`h-full w-full object-cover transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
          <a
            href={shot.page}
            target="_blank"
            rel="noreferrer noopener"
            title={shot.title}
            className="absolute bottom-1.5 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[13px] tracking-wide text-white/80 opacity-0 transition hover:bg-black/70 hover:text-white focus:opacity-100 group-hover:opacity-100"
          >
            {shot.title}
          </a>
        </>
      )}
    </figure>
  );
}
