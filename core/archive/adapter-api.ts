import type { NewsEventDraft } from "../news/schemas/news-event";

export interface ProviderPayload {
  // Provider-specific raw payload
  [key: string]: any;
}

export interface AdapterMeta {
  provider_id: string;
  source_id: string;
}

export interface Adapter {
  fetchOnce?(params?: any): Promise<ProviderPayload[]>;
  listen?(onMessage: (p: ProviderPayload) => void): Promise<void> | void;
  validate?(payload: ProviderPayload): boolean;
  normalize?(payload: ProviderPayload, meta: AdapterMeta): Promise<NewsEventDraft>;
}

export const AdapterBase: Adapter = {
  validate: (p: ProviderPayload) => !!p,
};

export default Adapter;
