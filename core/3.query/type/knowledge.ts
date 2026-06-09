export interface KnowledgeMapEntry {
  cluster_id: string;
  concept: string;
  type: string;
  layer: string;
  agent: {
    role: string;
    query_templates: string[];
    focus: string[];
    signal: string;
    when_to_use: string;
    invalid_when: string;
  };
  size: number;
}