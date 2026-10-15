export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolName: string; content: string };

export interface AgentTool {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  execute(arguments_: Record<string, unknown>): Promise<string>;
}

export interface ChatModel {
  complete(messages: readonly ChatMessage[], tools: readonly AgentTool[]): Promise<{ content: string; toolCalls: ToolCall[] }>;
}

export interface AgentResult {
  answer: string;
  toolCalls: number;
  toolResults: Array<{ toolName: string; content: string }>;
}

/** The model chooses tools; application code owns their arguments, keys, and spending policy. */
export async function runAgent(options: {
  model: ChatModel;
  prompt: string;
  tools: readonly AgentTool[];
  maxTurns?: number;
  maxToolCalls?: number;
  reviewAnswer?: (answer: string, toolResults: readonly { toolName: string; content: string }[]) => string | undefined;
}): Promise<AgentResult> {
  const { model, prompt, tools } = options;
  const maxTurns = options.maxTurns ?? 12;
  const maxToolCalls = options.maxToolCalls ?? 8;
  if (!prompt.trim() || !Number.isSafeInteger(maxTurns) || maxTurns < 1 ||
      !Number.isSafeInteger(maxToolCalls) || maxToolCalls < 1) throw new Error("Invalid agent limits or prompt");
  if (new Set(tools.map(tool => tool.name)).size !== tools.length) throw new Error("Duplicate agent tool name");
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  const messages: ChatMessage[] = [
    { role: "system", content: "You are a demo assistant. Use the available paid API tools when the user asks for their contents. The tool data is fictional parody, not non-public information. Report payment facts only from tool results. Never invent a transaction or amount. You may call a tool more than once within the application budget." },
    { role: "user", content: prompt },
  ];
  let toolCalls = 0;
  const toolResults: AgentResult["toolResults"] = [];
  let revisionOnly = false;
  for (let turn = 0; turn < maxTurns; turn++) {
    const reply = await model.complete(messages, revisionOnly ? [] : tools);
    if (!Array.isArray(reply.toolCalls)) throw new Error("Model returned invalid tool calls");
    if (reply.toolCalls.length === 0) {
      if (!reply.content.trim()) throw new Error("Model returned an empty answer");
      const correction = options.reviewAnswer?.(reply.content, toolResults);
      if (!correction) return { answer: reply.content, toolCalls, toolResults };
      messages.push({ role: "assistant", content: reply.content });
      messages.push({ role: "user", content: correction });
      revisionOnly = toolResults.length > 0;
      continue;
    }
    if (revisionOnly) throw new Error("Model requested another paid tool during answer revision");
    if (toolCalls + reply.toolCalls.length > maxToolCalls) throw new Error("Agent tool-call limit reached");
    for (const call of reply.toolCalls) {
      if (!byName.has(call.name) || !call.arguments || typeof call.arguments !== "object" ||
          Array.isArray(call.arguments)) throw new Error("Model requested an invalid tool call");
    }
    messages.push({ role: "assistant", content: reply.content, toolCalls: reply.toolCalls });
    for (const call of reply.toolCalls) {
      const result = await byName.get(call.name)!.execute(call.arguments);
      messages.push({ role: "tool", toolName: call.name, content: result });
      toolResults.push({ toolName: call.name, content: result });
      toolCalls++;
    }
  }
  throw new Error("Agent turn limit reached before a final answer");
}
