import type { AgentTool, ChatMessage, ChatModel, ToolCall } from "./agent-core.js";

/** Adapter for Ollama's native, non-streaming /api/chat tool calling API. */
export class OllamaChatModel implements ChatModel {
  readonly #endpoint: URL;
  readonly #model: string;
  readonly #fetch: typeof fetch;

  constructor(options: { model: string; baseUrl?: string; fetchImpl?: typeof fetch }) {
    if (!options.model.trim()) throw new Error("Set OLLAMA_MODEL to a tool-capable local model");
    const base = new URL(options.baseUrl ?? "http://127.0.0.1:11434");
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid OLLAMA_BASE_URL");
    this.#endpoint = new URL("/api/chat", base);
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
          ? { role: "assistant", content: message.content, ...(message.toolCalls?.length ? {
            tool_calls: message.toolCalls.map(call => ({ type: "function", function: { name: call.name, arguments: call.arguments } })),
          } : {}) }
          : message.role === "tool"
            ? { role: "tool", tool_name: message.toolName, content: message.content }
            : message),
        tools: tools.map(tool => ({ type: "function", function: {
          name: tool.name, description: tool.description, parameters: tool.parameters,
        } })),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Ollama chat failed with HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("message" in body)) throw new Error("Invalid Ollama chat response");
    const message = body.message;
    if (!message || typeof message !== "object" || !("role" in message) || message.role !== "assistant" ||
        !("content" in message) || typeof message.content !== "string") throw new Error("Invalid Ollama assistant message");
    const rawCalls = "tool_calls" in message ? message.tool_calls : undefined;
    if (rawCalls !== undefined && !Array.isArray(rawCalls)) throw new Error("Invalid Ollama tool calls");
    const calls: ToolCall[] = (rawCalls ?? []).map((call: unknown) => {
      if (!call || typeof call !== "object" || !("function" in call) || !call.function ||
          typeof call.function !== "object" || !("name" in call.function) ||
          typeof call.function.name !== "string" || !("arguments" in call.function) ||
          !call.function.arguments || typeof call.function.arguments !== "object" ||
          Array.isArray(call.function.arguments)) throw new Error("Invalid Ollama tool call");
      return { name: call.function.name, arguments: call.function.arguments as Record<string, unknown> };
    });
    return { content: message.content, toolCalls: calls };
  }
}
