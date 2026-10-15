import type { AgentResult } from "./agent-core.js";

type ToolResult = AgentResult["toolResults"][number];

export function paidReportEvidence(toolResults: readonly ToolResult[]): Array<{ reportId: string; headline: string }> {
  return toolResults.map(({ content }) => {
    const paid: unknown = JSON.parse(content);
    if (!paid || typeof paid !== "object" || Array.isArray(paid)) throw new Error("Invalid paid tool result");
    const value = paid as { resource?: { reportId?: unknown; headline?: unknown } };
    if (typeof value.resource?.reportId !== "string" || typeof value.resource.headline !== "string") {
      throw new Error("Paid tool result is missing report evidence");
    }
    return { reportId: value.resource.reportId, headline: value.resource.headline };
  });
}

/** Ask the model to ground its final answer in the paid API responses. */
export function reviewDemoAnswer(answer: string, toolResults: readonly ToolResult[]): string | undefined {
  if (!toolResults.length) return "Call an available paid API tool before answering. Use its actual result.";
  const reports = paidReportEvidence(toolResults);
  if (reports.every(({ reportId, headline }) => answer.includes(reportId) && answer.includes(headline))) return undefined;
  return "Revise your answer using the paid API tool results already shown. Include every report ID and its exact headline, then summarize the findings and payment amounts. Do not call another tool.";
}
