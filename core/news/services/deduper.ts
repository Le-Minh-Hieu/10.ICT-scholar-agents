import type { NewsEvent } from "../schemas/news-event.js";
import { log } from "../../../shared/utils/logger.js";

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return String(h >>> 0);
}

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','for','of','in','on','at','to','from','by','with','is','are','was','were','be','been','has','have','had'
]);

function normalizeText(s: string): string[] {
  if (!s) return [];
  const lowered = s.toLowerCase();
  // remove punctuation
  const cleaned = lowered.replace(/[\p{P}$+<=>^`|~]/gu, ' ');
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  // basic stemming (lightweight): remove common suffixes
  const stemmed = rawTokens.map(t => {
    if (t.length > 4 && t.endsWith('ing')) return t.slice(0, -3);
    if (t.length > 3 && (t.endsWith('ed') || t.endsWith('es'))) return t.replace(/(ed|es)$/, '');
    if (t.length > 2 && t.endsWith('ly')) return t.slice(0, -2);
    if (t.length > 1 && t.endsWith('s')) return t.slice(0, -1);
    return t;
  });
  // remove stopwords
  const filtered = stemmed.filter(t => !STOPWORDS.has(t));
  // deduplicate tokens
  const unique = Array.from(new Set(filtered));
  return unique;
}

function tokenJaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const uni = new Set([...sa, ...sb]).size;
  return inter / uni;
}

export class Deduper {
  private fingerprintIndex: Map<string, string> = new Map(); // fingerprintHash -> groupId
  private groupCounter = 0;

  dedupe(event: NewsEvent, existing: NewsEvent[] = []): { duplicate_group_id?: string | null; update_chain?: string[] } {
    const sourcePayloadHash = String(event.provenance?.payload_hash || '');
    const fingerprintTokens = normalizeText((event.title || '') + ' ' + (event.canonical_body || ''));
    const sortedTokens = fingerprintTokens.slice().sort();
    const fingerprint = sortedTokens.join(' ');
    const fingerprintHash = simpleHash(fingerprint || sourcePayloadHash || event.id || '');

    // exact fingerprint match
    if (this.fingerprintIndex.has(fingerprintHash)) {
      const gid = this.fingerprintIndex.get(fingerprintHash)!;
      log({ stage: 'NEWS_DEDUP', message: 'Fingerprint exact duplicate', data: { eventId: event.id, group: gid } });
      return { duplicate_group_id: gid, update_chain: [gid] };
    }

    // compare against existing normalized tokens for similarity
    for (const e of existing) {
      const etoks = normalizeText((e.title || '') + ' ' + (e.canonical_body || ''));
      const sim = tokenJaccard(sortedTokens, etoks.slice().sort());
      if (sim >= 0.6) {
        const gid = e.duplicate_group_id || `dup-${++this.groupCounter}`;
        this.fingerprintIndex.set(fingerprintHash, gid);
        log({ stage: 'NEWS_DEDUP', message: 'Fingerprint semantic duplicate merged', data: { eventId: event.id, group: gid, sim } });
        return { duplicate_group_id: gid, update_chain: [e.id] };
      }
    }

    // new group
    const newG = `dup-${++this.groupCounter}`;
    this.fingerprintIndex.set(fingerprintHash, newG);
    log({ stage: 'NEWS_DEDUP', message: 'New dedupe group created', data: { eventId: event.id, group: newG } });
    return { duplicate_group_id: null, update_chain: [] };
  }
}

export default Deduper;
