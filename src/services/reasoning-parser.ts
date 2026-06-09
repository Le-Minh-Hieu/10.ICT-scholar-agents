import { ReasoningAST, NarrativeSection, NarrativeParagraph, SectionType } from "../../types/reasoning";

const ICT_CONCEPTS = [
  "FVG", "BSL", "SSL", "SMT", "MSS", "BMS", "OB", "Breaker Block", "Breaker",
  "Kill Zone", "OTE", "Premium", "Discount", "Equilibrium", "NWOG", "C-DISD",
  "Judas Swing", "Stop Hunt", "Inducement", "Market Structure Shift",
  "Bullish", "Bearish", "Liquidity Sweep", "Draw on Liquidity"
];

const CITATION_REGEX = /\[CHUNK_ID:(chunk[_-]\d+)\]/g;
const SECTION_HEADER_REGEX = /^\d+\.\s+\*\*(.*?)\*\*:\s*(.*)/;
const STEP_REGEX = /^(\d+)\.\s+(.*)/;
const BOLD_LABEL_REGEX = /^\*\*(.*?)\*\*:/;

export const parseReasoning = (rawText: string, agentId?: string): ReasoningAST => {
  // Normalize missing newlines before numbered steps/headers if they are crammed
  let processedText = rawText.replace(/([.\]])(\d+\.\s+\*\*)/g, '$1\n$2');
  
  const lines = processedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const sections: NarrativeSection[] = [];
  let currentSection: NarrativeSection | null = null;

  const createSection = (title: string, type: SectionType): NarrativeSection => {
    const section: NarrativeSection = {
      id: `section_${sections.length}`,
      type,
      title,
      paragraphs: []
    };
    sections.push(section);
    return section;
  };

  const getSectionType = (title: string): SectionType => {
    const t = title.toUpperCase();
    if (t.includes('MONTHLY') || t.includes('WEEKLY') || t.includes('HTF')) return 'HTF';
    if (t.includes('DAILY') || t.includes('H4') || t.includes('ITF')) return 'ITF';
    if (t.includes('M15') || t.includes('M5') || t.includes('M1') || t.includes('LTF')) return 'LTF';
    if (t.includes('LOGIC') || t.includes('PRINCIPLE')) return 'LOGIC';
    if (t.includes('CONCLUSION') || t.includes('DECISION')) return 'CONCLUSION';
    return 'GENERAL';
  };

  lines.forEach((line) => {
    // 1. Detect Section Headers
    const sectionMatch = line.match(SECTION_HEADER_REGEX);
    const boldMatch = line.match(BOLD_LABEL_REGEX);

    if (sectionMatch) {
      const title = sectionMatch[1];
      currentSection = createSection(title, getSectionType(title));
      if (sectionMatch[2]) {
        processParagraph(sectionMatch[2], currentSection);
      }
      return;
    }

    if (boldMatch && line.length < 60) { // Likely a header if short
      const title = boldMatch[1];
      currentSection = createSection(title, getSectionType(title));
      return;
    }

    // Default section if none exists
    if (!currentSection) {
      currentSection = createSection('Executive Analysis', 'GENERAL');
    }

    // 2. Process line as a paragraph or part of one
    processParagraph(line, currentSection);
  });

  return { agentId, sections };
};

function processParagraph(text: string, section: NarrativeSection) {
  const stepMatch = text.match(STEP_REGEX);
  let content = text;
  let isStep = false;
  let stepIndex: number | undefined;

  if (stepMatch) {
    isStep = true;
    stepIndex = parseInt(stepMatch[1], 10);
    content = stepMatch[2];
  }

  // Extract metadata without stripping (unless requested, but feedback says preserve flow)
  // We'll extract for the badges but keep the text as is.
  const citations: string[] = [];
  let m;
  while ((m = CITATION_REGEX.exec(content)) !== null) {
    citations.push(m[1]);
  }

  const concepts = ICT_CONCEPTS.filter(concept => 
    new RegExp(`\\b${concept}\\b`, 'i').test(content)
  );

  section.paragraphs.push({
    id: `p_${section.id}_${section.paragraphs.length}`,
    content,
    citations,
    concepts,
    isStep,
    stepIndex
  });
}
