import type { AgentTool, ChatMessage, ChatModel, ToolCall } from "./agent-core.js";

/** Adapter for LM Studio's OpenAI-compatible, non-streaming tool API. */
export class LmStudioChatModel implements ChatModel {
  readonly #endpoint: URL;
  readonly #model: string;
  readonly #fetch: typeof fetch;

  constructor(options: { model: string; baseUrl?: string; fetchImpl?: typeof fetch }) {
    if (!options.model.trim()) throw new Error("Set LM_STUDIO_MODEL to a loaded tool-capable model");
    const base = new URL(options.baseUrl ?? "http://127.0.0.1:1234");
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid LM_STUDIO_BASE_URL");
    this.#endpoint = new URL("/v1/chat/completions", base);
    this.#model = options.model;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async complete(messages: readonly ChatMessage[], tools: readonly AgentTool[]) {
    const response = await this.#fetch(this.#endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.#model,
        stream: false,
        messages: messages.map(message => message.role === "assistant"
          ? { role: "assistant", content: message.content || null, ...(message.toolCalls?.length ? {
            tool_calls: message.toolCalls.map(call => ({ id: call.id, type: "function",
              function: { name: call.name, arguments: JSON.stringify(call.arguments) } })),
          } : {}) }
          : message.role === "tool"
            ? { role: "tool", tool_call_id: message.toolCallId, content: message.content }
            : message),
        tools: tools.map(tool => ({ type: "function", function: {
          name: tool.name, description: tool.description, parameters: tool.parameters,
        } })),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`LM Studio chat failed with HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("choices" in body) || !Array.isArray(body.choices)) {
      throw new Error("Invalid LM Studio chat response");
    }
    const choice = body.choices[0];
    if (!choice || typeof choice !== "object" || !("message" in choice) ||
        !choice.message || typeof choice.message !== "object" ||
        !("role" in choice.message) || choice.message.role !== "assistant") {
      throw new Error("Invalid LM Studio assistant message");
    }
    const message = choice.message;
    const content = "content" in message ? message.content : null;
    if (content !== null && typeof content !== "string") throw new Error("Invalid LM Studio content");
    const rawCalls = "tool_calls" in message ? message.tool_calls : undefined;
    if (rawCalls !== undefined && !Array.isArray(rawCalls)) throw new Error("Invalid LM Studio tool calls");
    const calls: ToolCall[] = (rawCalls ?? []).map((call: unknown) => {
      if (!call || typeof call !== "object" || !("id" in call) || typeof call.id !== "string" ||
          !call.id || !("type" in call) || call.type !== "function" ||
          !("function" in call) || !call.function || typeof call.function !== "object" ||
          !("name" in call.function) || typeof call.function.name !== "string" ||
          !("arguments" in call.function) || typeof call.function.arguments !== "string") {
        throw new Error("Invalid LM Studio tool call");
      }
      let arguments_: unknown;
      try { arguments_ = JSON.parse(call.function.arguments); }
      catch { throw new Error("Invalid LM Studio tool arguments"); }
      if (!arguments_ || typeof arguments_ !== "object" || Array.isArray(arguments_)) {
        throw new Error("Invalid LM Studio tool arguments");
      }
      return { id: call.id, name: call.function.name, arguments: arguments_ as Record<string, unknown> };
    });
    return { content: content ?? "", toolCalls: calls };
  }
}
