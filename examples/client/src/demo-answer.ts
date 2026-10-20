import type { AgentResult } from "./agent-core.js";

type ToolResult = AgentResult["toolResults"][number];

export function paidReportEvidence(toolResults: readonly ToolResult[]): Array<{
  reportId: string; headline: string; chargedAtomicUnits: string;
}> {
  return toolResults.map(({ content }) => {
    const paid: unknown = JSON.parse(content);
    if (!paid || typeof paid !== "object" || Array.isArray(paid)) throw new Error("Invalid paid tool result");
    const value = paid as { resource?: { reportId?: unknown; headline?: unknown }; chargedAtomicUnits?: unknown };
    if (typeof value.resource?.reportId !== "string" || typeof value.resource.headline !== "string" ||
        typeof value.chargedAtomicUnits !== "string" || !/^\d+$/.test(value.chargedAtomicUnits)) {
      throw new Error("Paid tool result is missing report evidence");
    }
    return { reportId: value.resource.reportId, headline: value.resource.headline,
      chargedAtomicUnits: value.chargedAtomicUnits };
  });
}

/** Ask the model to ground its final answer in the paid API responses. */
export function reviewDemoAnswer(answer: string, toolResults: readonly ToolResult[]): string | undefined {
  if (!toolResults.length) return "Call an available paid API tool before answering. Use its actual result.";
  const reports = paidReportEvidence(toolResults);
  if (reports.every(({ chargedAtomicUnits }) => answer.includes(chargedAtomicUnits)) &&
      reports.every(({ reportId, headline }) => !answer.includes(reportId) && !answer.includes(headline))) return undefined;
  return "Revise your answer using the paid API tool results already shown. Give your own concise judgment of what the report actually reveals and whether it is useful. Include the charged amount in atomic token units. Do not copy the report ID, exact headline, or field labels. Do not call another tool.";
}
