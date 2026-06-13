// =======================
// RETRIEVAL ATTRIBUTION TELEMETRY
// =======================
// Tracks which queries trigger which chunks
// Enables per-lane impact analysis

export interface QueryAttribution {
  query: string;
  lane: "lane0" | "lane1" | "lane2";
  chunkIds: string[];
}

export interface LaneMetrics {
  lane0QueryCount: number;
  lane1QueryCount: number;
  lane2QueryCount: number;
  
  lane0TriggeredChunks: number;
  lane1TriggeredChunks: number;
  lane2TriggeredChunks: number;
  
  lane0UniqueChunks: string[];
  lane1UniqueChunks: string[];
  lane2UniqueChunks: string[];
  
  lane0SharedChunks: string[];
  lane1SharedChunks: string[];
  lane2SharedChunks: string[];
  
  lane2HitRate: number;
  
  queryAttribution: QueryAttribution[];
}

export class RetrievalAttributionTracker {
  private attributions: Map<string, Set<string>> = new Map(); // query → chunk_ids
  private laneMap: Map<string, "lane0" | "lane1" | "lane2"> = new Map(); // query → lane
  
  reset() {
    this.attributions.clear();
    this.laneMap.clear();
  }
  
  /**
   * Register lane assignment for queries
   */
  registerLanes(queries: Array<{query: string, lane: "lane0" | "lane1" | "lane2"}>) {
    for (const {query, lane} of queries) {
      this.laneMap.set(query, lane);
    }
  }
  
  /**
   * Track that a query retrieved specific chunks
   */
  trackQueryChunks(query: string, chunkIds: string[]) {
    if (!this.attributions.has(query)) {
      this.attributions.set(query, new Set());
    }
    const existing = this.attributions.get(query)!;
    for (const id of chunkIds) {
      existing.add(id);
    }
  }
  
  /**
   * Compute lane metrics after retrieval completes
   */
  computeMetrics(): LaneMetrics {
    const lane0Queries: string[] = [];
    const lane1Queries: string[] = [];
    const lane2Queries: string[] = [];
    
    // Group queries by lane
    for (const [query, lane] of this.laneMap.entries()) {
      if (lane === "lane0") lane0Queries.push(query);
      else if (lane === "lane1") lane1Queries.push(query);
      else if (lane === "lane2") lane2Queries.push(query);
    }
    
    // Get chunks triggered by each lane
    const lane0Chunks = new Set<string>();
    const lane1Chunks = new Set<string>();
    const lane2Chunks = new Set<string>();
    
    for (const query of lane0Queries) {
      const chunks = this.attributions.get(query) || new Set();
      chunks.forEach(id => lane0Chunks.add(id));
    }
    
    for (const query of lane1Queries) {
      const chunks = this.attributions.get(query) || new Set();
      chunks.forEach(id => lane1Chunks.add(id));
    }
    
    for (const query of lane2Queries) {
      const chunks = this.attributions.get(query) || new Set();
      chunks.forEach(id => lane2Chunks.add(id));
    }
    
    // Compute unique chunks (only triggered by this lane)
    const lane0Unique = [...lane0Chunks].filter(id => 
      !lane1Chunks.has(id) && !lane2Chunks.has(id)
    );
    
    const lane1Unique = [...lane1Chunks].filter(id => 
      !lane0Chunks.has(id) && !lane2Chunks.has(id)
    );
    
    const lane2Unique = [...lane2Chunks].filter(id => 
      !lane0Chunks.has(id) && !lane1Chunks.has(id)
    );
    
    // Compute shared chunks (triggered by this lane AND others)
    const lane0Shared = [...lane0Chunks].filter(id => 
      lane1Chunks.has(id) || lane2Chunks.has(id)
    );
    
    const lane1Shared = [...lane1Chunks].filter(id => 
      lane0Chunks.has(id) || lane2Chunks.has(id)
    );
    
    const lane2Shared = [...lane2Chunks].filter(id => 
      lane0Chunks.has(id) || lane1Chunks.has(id)
    );
    
    // Build query attribution array
    const queryAttribution: QueryAttribution[] = [];
    for (const [query, chunkSet] of this.attributions.entries()) {
      const lane = this.laneMap.get(query) || "lane0";
      queryAttribution.push({
        query,
        lane,
        chunkIds: Array.from(chunkSet)
      });
    }
    
    // Compute hit rate
    const lane2HitRate = lane2Queries.length > 0 
      ? lane2Chunks.size / lane2Queries.length 
      : 0;
    
    return {
      lane0QueryCount: lane0Queries.length,
      lane1QueryCount: lane1Queries.length,
      lane2QueryCount: lane2Queries.length,
      
      lane0TriggeredChunks: lane0Chunks.size,
      lane1TriggeredChunks: lane1Chunks.size,
      lane2TriggeredChunks: lane2Chunks.size,
      
      lane0UniqueChunks: lane0Unique,
      lane1UniqueChunks: lane1Unique,
      lane2UniqueChunks: lane2Unique,
      
      lane0SharedChunks: lane0Shared,
      lane1SharedChunks: lane1Shared,
      lane2SharedChunks: lane2Shared,
      
      lane2HitRate,
      
      queryAttribution
    };
  }
}

// Singleton instance
export const attributionTracker = new RetrievalAttributionTracker();