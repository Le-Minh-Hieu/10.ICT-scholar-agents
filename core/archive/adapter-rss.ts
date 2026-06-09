import { Adapter } from "./adapter-api";
import type { NewsEventDraft } from "../news/schemas/news-event";

// Minimal RSS adapter skeleton — placeholder for real fetch parsing
export const rssAdapter: Adapter = {
  async fetchOnce(_params?: any) {
    // In production this would fetch an RSS feed and return raw items
    return [];
  },
  async normalize(payload: any, meta: any): Promise<NewsEventDraft> {
    return {
      provider_id: meta.provider_id,
      source_id: meta.source_id,
      title: (payload.title || payload.headline || "").toString(),
      canonical_body: (payload.description || payload.content || "").toString(),
      published_at: payload.pubDate || new Date().toISOString(),
    } as NewsEventDraft;
  }
};

export default rssAdapter;
