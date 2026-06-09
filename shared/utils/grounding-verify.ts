export function verifyGrounding(output: any, chunks: any[]) {
  // 1. Check references exist
  if (!output?.references || !Array.isArray(output.references)) {
    return { valid: false, reason: "Missing references" };
  }

  // 2. Check principles exist (Task 6 requirement)
  if (!output?.principles || !Array.isArray(output.principles) || output.principles.length === 0) {
    return { valid: false, reason: "Missing grounded principles" };
  }

  // 3. Build valid chunk id set
  const validIds = new Set(
    chunks.map((c, i) => String(c.chunk_id || i))
  );

  // 4. Validate references
  const referencedChunks = output.references
    .map((ref: string) => {
      const id = ref.replace("CHUNK_ID:", "").trim();
      return chunks.find((c, i) => String(c.chunk_id || i) === id);
    })
    .filter(Boolean);

  if (referencedChunks.length === 0) {
    return { valid: false, reason: "No valid chunk reference" };
  }

  // 5. Validate principles chunk_id
  const principleIds = output.principles.flatMap((p: any) => {
    const raw = (p.chunk_id || "");
    const matches = raw.match(/chunk_\d+/g);
    return matches ? matches : [];
  });

  const validPrinciples = principleIds.every((id: string) => validIds.has(id));

  if (!validPrinciples) {
    return { valid: false, reason: "Invalid principle chunk reference" };
  }

  // 6. Enforce minimum number of principles (avoid trivial grounding)
  if (output.principles.length < 2) {
    return { valid: false, reason: "Too few grounded principles" };
  }

  // 7. Content overlap check (notes vs chunk)
  const notes = (output.notes || "").toLowerCase();

  function hasContentOverlap(notes: string, chunkText: string): boolean {
    const keywords = notes
      .split(/\W+/)
      .filter(w => w.length > 4);

    let matchCount = 0;

    for (const word of keywords) {
      if (chunkText.toLowerCase().includes(word)) {
        matchCount++;
      }
    }

    return matchCount >= 4;
  }

  const isGrounded = referencedChunks.some((chunk: any) =>
    hasContentOverlap(notes, chunk.text)
  );

  if (!isGrounded) {
    return { valid: false, reason: "Fake grounding (no content overlap)" };
  }

  // 8. Reject overly generic reasoning
  if (notes.length < 200) {
    return { valid: false, reason: "Too generic reasoning" };
  }

  // 9. Ensure principles are actually used in notes (critical for Task 6)
  const principlesUsed = output.principles.some((p: any) => {
    const id = (p.chunk_id || "").replace("CHUNK_ID:", "").trim();
    return notes.includes(id);
  });

  if (!principlesUsed) {
    return { valid: false, reason: "Principles not used in reasoning" };
  }
  if (!output.confidence) {
    return { valid: false, reason: "Missing confidence" };
}


  return { valid: true };
}