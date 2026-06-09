
export type RelationshipType = 
  | "INVERSE_CORRELATION" 
  | "POSITIVE_CORRELATION" 
  | "LEADING_INDICATOR" 
  | "LAGGING_RESPONSE";

export interface AssetRelationship {
  source_asset: string;
  target_asset: string;
  type: RelationshipType;
  base_weight: number; // 0.0 to 1.0
  description: string;
}

export interface SMTSignal {
  assets: [string, string];
  type: "BULLISH_SMT" | "BEARISH_SMT";
  divergence_type: "HH_VS_LH" | "LL_VS_HL";
  confidence: number;
  is_at_pd_array: boolean;
  notes?: string;
}

export interface RelationalContext {
  primary_asset: string;
  external_influences: ExternalInfluence[];
  smt_hints: SMTSignal[];
  overall_relational_alignment: number; // -1.0 to 1.0
}

export interface ExternalInfluence {
  source_asset: string;
  relationship: RelationshipType;
  direction: "BULLISH_PRESSURE" | "BEARISH_PRESSURE" | "NEUTRAL";
  confidence: number;
  temporal_decay: number; // 1.0 = fresh, 0.0 = expired
}

/**
 * Registry of standard ICT intermarket relationships.
 */
export const RELATIONAL_REGISTRY: AssetRelationship[] = [
  {
    source_asset: "DXY",
    target_asset: "EURUSD",
    type: "INVERSE_CORRELATION",
    base_weight: 0.85,
    description: "Standard inverse relationship between Dollar Index and Euro."
  },
  {
    source_asset: "DXY",
    target_asset: "GBPUSD",
    type: "INVERSE_CORRELATION",
    base_weight: 0.8,
    description: "Standard inverse relationship between Dollar Index and Cable."
  },
  {
    source_asset: "ES",
    target_asset: "NQ",
    type: "POSITIVE_CORRELATION",
    base_weight: 0.9,
    description: "Highly correlated US equity indices (S&P 500 and Nasdaq 100)."
  },
  {
    source_asset: "ZN", // 10Y T-Notes
    target_asset: "ES",
    type: "LEADING_INDICATOR",
    base_weight: 0.6,
    description: "Bonds often lead risk assets (inverse relationship to yields)."
  },
  {
    source_asset: "YIELDS",
    target_asset: "EURUSD",
    type: "INVERSE_CORRELATION",
    base_weight: 0.8,
    description: "Inverse pressure of rising Treasury Yields (US10Y/US20Y) on EURUSD."
  }
];
