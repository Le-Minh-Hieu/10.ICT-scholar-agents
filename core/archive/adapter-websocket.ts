import { Adapter } from "./adapter-api";
import type { NewsEventDraft } from "../news/schemas/news-event";

export const websocketAdapter: Adapter = {
  listen(onMessage) {
    // Placeholder: wire a websocket client in production
    return;
  },
  async normalize(payload: any, meta: any): Promise<NewsEventDraft> {
    return {
      provider_id: meta.provider_id,
      source_id: meta.source_id,
      title: (payload.title || payload.headline || "").toString(),
      canonical_body: (payload.body || payload.text || "").toString(),
      published_at: payload.published_at || new Date().toISOString(),
    } as NewsEventDraft;
  }
};

export default websocketAdapter;
