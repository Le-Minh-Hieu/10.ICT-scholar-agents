export type SectionType = 'HTF' | 'ITF' | 'LTF' | 'LOGIC' | 'CONCLUSION' | 'GENERAL';

export interface ReasoningAST {
  agentId?: string;
  sections: NarrativeSection[];
}

export interface NarrativeSection {
  id: string;
  type: SectionType;
  title?: string;
  paragraphs: NarrativeParagraph[];
}

export interface NarrativeParagraph {
  id: string;
  content: string; // The full text with preserved flow
  citations: string[]; // Collected from the text
  concepts: string[]; // Identified in the text
  isStep?: boolean;
  stepIndex?: number;
}
