import { Confidence } from "../contracts/pmso";

export function normalizeConfidence(confidence: Confidence | "high" | "medium" | "low" | number | null | undefined): Confidence {
  if (!confidence) {
    return 0.1;
  }

  if (typeof confidence === 'number') {
    return Math.max(0, Math.min(1, confidence)); // Clamp between 0 and 1
  }

  if (confidence === 'high') {
    return 0.9;
  }
  if (confidence === 'medium') {
    return 0.7;
  }
  if (confidence === 'low') {
    return 0.4;
  }

  return 0.5; // Default for unexpected strings
}

export function averageConfidence(confidences: (Confidence | "high" | "medium" | "low" | number | null | undefined)[]): Confidence {
  if (!confidences || confidences.length === 0) {
    return normalizeConfidence(null);
  }

  const normalizedConfidences = confidences.map(normalizeConfidence);

  const totalConfidence = normalizedConfidences.reduce((sum, c) => sum + c, 0);

  return totalConfidence / normalizedConfidences.length;
}
