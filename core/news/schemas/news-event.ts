export type UUID = string;

export type PersistenceClass =
  | 'EPHEMERAL'
  | 'SESSION'
  | 'MULTI_SESSION'
  | 'REGIME'
  | 'TRANSITIONAL';

export type EventType =
  | 'ECONOMIC'
  | 'GEOPOLITICAL'
  | 'CENTRAL_BANK'
  | 'LIQUIDITY'
  | 'MARKET'
  | 'OTHER';

export interface Provenance {
  provider_id: string;
  source_id: string;
  original_url?: string;
  payload_hash: string;
  fetched_at: string; // UTC ISO
}

export interface NewsEvent {
  id: UUID; // immutable
  provider_id: string;
  source_id: string;
  published_at: string; // UTC ISO
  observed_at: string; // UTC ISO (ingest time)
  title: string;
  canonical_body: string;
  event_type: EventType;
  importance_score: number; // 0-1
  impact_tags: string[]; // e.g. ["USD","EU","BANKING"]
  persistence_class: PersistenceClass;
  confidence: number; // 0-1 ingest confidence
  duplicate_group_id?: string | null;
  rumor_flag?: boolean;
  provenance: Provenance;
  update_chain?: string[]; // list of prior event ids
  shadow_reasoned?: boolean;
  shadow_reasoned_at?: string;
  category?: string;
  currency?: string;
  impact?: string;
  impact_score?: number;
  metadata?: any;
}

export interface NewsEventDraft extends Partial<NewsEvent> {
  // intermediate shape used during normalization
}
