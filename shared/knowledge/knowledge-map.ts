import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Retrieves grounded knowledge from the internal knowledge map.
 * @param type The type of knowledge to retrieve (e.g., "structure", "liquidity").
 * @returns A string containing the relevant grounded knowledge or "MISSING KNOWLEDGE".
 */
export async function getKnowledge(type: string): Promise<string> {
  try {
    const dataPath = path.resolve(__dirname, "../../data/knowledge_map.json");
    
    if (!fs.existsSync(dataPath)) {
      return "MISSING KNOWLEDGE";
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const knowledgeMap = JSON.parse(rawData);

    // Find concepts that match the requested type in their name, role, or layer.
    const relevant = knowledgeMap.filter((item: any) =>
      item.concept.toLowerCase().includes(type.toLowerCase()) ||
      item.agent?.role?.toLowerCase().includes(type.toLowerCase()) ||
      item.layer?.toLowerCase().includes(type.toLowerCase())
    );

    if (relevant.length === 0) {
      return "MISSING KNOWLEDGE";
    }

    return relevant
      .map((item: any) => {
        const focus = item.agent?.focus ? item.agent.focus.join(", ") : "N/A";
        return `CONCEPT: ${item.concept}\nROLE: ${item.agent?.role || "N/A"}\nFOCUS: ${focus}`;
      })
      .join("\n\n");
  } catch (error) {
    console.error("Error in getKnowledge:", error);
    return "MISSING KNOWLEDGE";
  }
}
