/// <reference types="node" />

import fs from "fs";
import path from "path";

// ===== PATH =====
const CLUSTER_FILE = path.join(process.cwd(), "data/cluster/cluster_result.json");
const EMBEDDING_DIR = path.join(process.cwd(), "data/vectors");
const OUTPUT_FILE = path.join(process.cwd(), "data/cluster/refined_clusters.json");

// ===== CONFIG =====
const MAX_CLUSTER_SIZE = 18;
const MIN_CLUSTER_SIZE = 3;

const K = 4;
const SIM_THRESHOLD = 0.82;

// ===== TYPES =====
type Cluster = {
  cluster_id: string;
  chunk_ids: string[];
};

type VectorItem = {
  chunk_id: string;
  embedding: number[];
};

// ===== COSINE =====
function cosine(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===== LOAD VECTORS =====
function loadVectors(): Record<string, VectorItem> {
  const files = fs.readdirSync(EMBEDDING_DIR);
  const map: Record<string, VectorItem> = {};

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const data: VectorItem[] = JSON.parse(
      fs.readFileSync(path.join(EMBEDDING_DIR, file), "utf-8")
    );

    for (const v of data) {
      map[v.chunk_id] = v;
    }
  }

  console.log(`📦 Loaded vectors: ${Object.keys(map).length}`);
  return map;
}

// ===== BUILD LOCAL GRAPH =====
function buildGraph(ids: string[], vectors: Record<string, VectorItem>) {
  const knn: Record<string, string[]> = {};

  for (const id of ids) {
    const v = vectors[id];

    if (!v) {
      console.log("⚠️ Missing vector:", id);
      continue;
    }

    const sims: { id: string; sim: number }[] = [];

    for (const otherId of ids) {
      if (id === otherId) continue;

      const u = vectors[otherId];
      if (!u) continue;

      const sim = cosine(v.embedding, u.embedding);

      if (sim >= SIM_THRESHOLD) {
        sims.push({ id: otherId, sim });
      }
    }

    sims.sort((a, b) => b.sim - a.sim);
    knn[id] = sims.slice(0, K).map(s => s.id);
  }

  const graph: Record<string, string[]> = {};

  for (const id in knn) {
    graph[id] = [];

    for (const neighbor of knn[id]) {
      if (knn[neighbor]?.includes(id)) {
        graph[id].push(neighbor);
      }
    }
  }

  return graph;
}

// ===== BFS =====
function clusterGraph(graph: Record<string, string[]>) {
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const node in graph) {
    if (visited.has(node)) continue;

    const queue = [node];
    const cluster: string[] = [];

    visited.add(node);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const neighbor of graph[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (cluster.length >= MIN_CLUSTER_SIZE) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

// ===== REFINE =====
function refineClusters(
  clusters: Cluster[],
  vectors: Record<string, VectorItem>
) {
  const refined: Cluster[] = [];
  let newId = 0;

  let largeCount = 0;

  for (const cluster of clusters) {
    const size = cluster.chunk_ids.length;

    console.log(`➡️ Cluster ${cluster.cluster_id} size: ${size}`);

    if (size <= MAX_CLUSTER_SIZE) {
      refined.push({
        cluster_id: `rc_${newId++}`,
        chunk_ids: cluster.chunk_ids
      });
      continue;
    }

    largeCount++;
    console.log(`🔧 Splitting cluster ${cluster.cluster_id} (${size})`);

    const graph = buildGraph(cluster.chunk_ids, vectors);
    const subClusters = clusterGraph(graph);

    console.log(`   → Split into ${subClusters.length} clusters`);

    for (const sub of subClusters) {
      refined.push({
        cluster_id: `rc_${newId++}`,
        chunk_ids: sub
      });
    }
  }

  console.log(`🔥 Large clusters found: ${largeCount}`);

  return refined;
}

// ===== MAIN =====
function main() {
  console.log("📂 Loading clusters...");
  const clusters: Cluster[] = JSON.parse(
    fs.readFileSync(CLUSTER_FILE, "utf-8")
  );

  console.log(`📊 Total clusters: ${clusters.length}`);

  console.log("📂 Loading vectors...");
  const vectors = loadVectors();

  console.log("🧠 Refining...");
  const refined = refineClusters(clusters, vectors);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(refined, null, 2));

  console.log(`✅ Final clusters: ${refined.length}`);
}

main();