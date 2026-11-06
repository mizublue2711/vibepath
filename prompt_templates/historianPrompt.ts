// Civil War Historian Prompt Templates & Helpers

export interface BattleContext {
  name: string;
  date: string;
  location: string;
  theater: string;
  outcome: string;
  casualties?: { total?: number };
  totalCasualties?: number;
  unionCommanders?: Array<{ name: string; rank?: string }>;
  confederateCommanders?: Array<{ name: string; rank?: string }>;
}

export function buildHistorianSystemInstruction(timelineYear: string, battleContext?: BattleContext): string {
  const contextDescription = battleContext
    ? `${battleContext.name} (${battleContext.date}), Theater: ${battleContext.theater}, Outcome: ${battleContext.outcome}, Total Casualties: ~${
        battleContext.casualties?.total
          ? battleContext.casualties.total.toLocaleString()
          : battleContext.totalCasualties
          ? battleContext.totalCasualties.toLocaleString()
          : "N/A"
      }`
    : "Broad overview of Civil War campaigns";

  return `You are the AI Civil War Historian, an educational scholar speaking to high school history students and their educator.
Your knowledge is deeply grounded in official NPS historical records (referencing the NPS Civil War Timeline), primary source documents (letters, soldier diaries, military orders, Lincoln's dispatches), operational logistics, geographical strategy, and the human cost of the American Civil War (1861–1865).

GUIDELINES FOR YOUR RESPONSES:
1. Tone: Engaging, intellectually rigorous yet accessible for high school students (grades 9-12), objective, respectful of the immense human toll, and historically accurate.
2. Contextual Awareness:
   - Current timeline point being viewed: ${timelineYear}
   - Currently inspected battle (if any): ${contextDescription}
3. Pedagogical Depth:
   - Provide direct, concise, and structured answers (3-4 concise paragraphs or bullet points).
   - Explain the "Why" behind tactical decisions (terrain, supply lines, communications, leadership temperament).
   - Highlight 1 key primary source quote or perspective when relevant.
   - Conclude with 1 brief discussion question for classroom debate.`;
}

export function buildHistorianUserPrompt(query: string, battleContext?: BattleContext): string {
  const sanitizedQuery = query.slice(0, 2000).trim();
  if (!battleContext) {
    return sanitizedQuery;
  }
  const unionCmds = battleContext.unionCommanders?.map((c) => `${c.name} (${c.rank || 'Officer'})`).join(', ') || "N/A";
  const confedCmds = battleContext.confederateCommanders?.map((c) => `${c.name} (${c.rank || 'Officer'})`).join(', ') || "N/A";
  return `[Context: ${battleContext.name}, ${battleContext.date}, Location: ${battleContext.location}, Union: ${unionCmds}, Confederate: ${confedCmds}]\n\nQuestion: ${sanitizedQuery}`;
}
