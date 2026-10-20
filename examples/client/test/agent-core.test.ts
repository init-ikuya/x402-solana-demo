import assert from "node:assert/strict";
import { test } from "node:test";
import { runAgent, type AgentActivity, type AgentTool, type ChatMessage, type ChatModel } from "../src/agent-core.js";
import { reviewDemoAnswer } from "../src/demo-answer.js";
import { OllamaChatModel } from "../src/ollama-model.js";
import { LmStudioChatModel } from "../src/lm-studio-model.js";

test("model calls a paid tool twice, sees both results, and answers", async () => {
  const invocations: string[] = [];
  const tool: AgentTool = {
    name: "get_trump_insider_exact", description: "Paid fictional API",
    parameters: { type: "object", properties: {} },
    async execute() { invocations.push("paid"); return JSON.stringify({ charge: "1000", sample: invocations.length }); },
  };
  const model: ChatModel = {
    async complete(messages: readonly ChatMessage[]) {
      const results = messages.filter(message => message.role === "tool");
      if (results.length < 2) return { content: "", toolCalls: [{ name: tool.name, arguments: {} }] };
      assert.equal(results.length, 2);
      assert.match(results[0].content, /"sample":1/);
      assert.match(results[1].content, /"sample":2/);
      return { content: "Two parody reports cost 2000 units.", toolCalls: [] };
    },
  };
  const result = await runAgent({ model, prompt: "Call the paid API twice", tools: [tool], maxToolCalls: 2 });
  assert.equal(result.toolCalls, 2);
  assert.equal(result.answer, "Two parody reports cost 2000 units.");
  assert.equal(invocations.length, 2);
});

test("agent stops before executing an unknown or over-budget tool call", async () => {
  let executed = 0;
  const tool: AgentTool = { name: "paid", description: "Paid", parameters: { type: "object", properties: {} },
    async execute() { executed++; return "ok"; } };
  await assert.rejects(runAgent({ model: { async complete() { return { content: "", toolCalls: [
    { name: "paid", arguments: {} }, { name: "other", arguments: {} },
  ] }; } }, prompt: "test", tools: [tool] }), /invalid tool call/);
  await assert.rejects(runAgent({ model: { async complete() { return { content: "", toolCalls: [
    { name: "paid", arguments: {} }, { name: "paid", arguments: {} },
  ] }; } }, prompt: "test", tools: [tool], maxToolCalls: 1 }), /tool-call limit/);
  assert.equal(executed, 0);
});

test("agent revises a copied report into a grounded verdict without another payment", async () => {
  const reportId = "FICTION-A4B5C6D7";
  const headline = "A private briefing precedes the public rollout";
  let payments = 0;
  let turns = 0;
  const activity: AgentActivity[] = [];
  const tool: AgentTool = { name: "paid", description: "Paid", parameters: { type: "object", properties: {} },
    async execute() {
      payments++;
      return JSON.stringify({ resource: { reportId, headline }, chargedAtomicUnits: "300" });
    } };
  const model: ChatModel = { async complete(messages, tools) {
    turns++;
    if (turns === 1) return { content: "This is a generic answer.", toolCalls: [] };
    if (turns === 2) {
      assert.equal(tools.length, 1);
      assert.match(messages.at(-1)!.content, /Call an available paid API tool/);
      return { content: "", toolCalls: [{ name: "paid", arguments: {} }] };
    }
    if (turns === 3) return { content: `${reportId}: ${headline}. It cost 300 units.`, toolCalls: [] };
    assert.equal(tools.length, 0);
    assert.match(messages.at(-1)!.content, /Do not copy the report ID/);
    return { content: "It is only a teaser for a later announcement, so I would not act on it. The charge was 300 atomic token units.", toolCalls: [] };
  } };
  const result = await runAgent({ model, prompt: "Get the report", tools: [tool], reviewAnswer: reviewDemoAnswer,
    onActivity: stage => activity.push(stage) });
  assert.equal(payments, 1);
  assert.equal(result.toolCalls, 1);
  assert.equal(result.toolResults.length, 1);
  assert.doesNotMatch(result.answer, /FICTION-A4B5C6D7/);
  assert.match(result.answer, /300 atomic token units/);
  assert.deepEqual(activity, ["selecting_tool", "selecting_tool", "using_tool", "evaluating_report", "revising_answer"]);
});

test("Ollama adapter sends native tool schema and preserves tool results in the next turn", async () => {
  const bodies: unknown[] = [];
  const model = new OllamaChatModel({ model: "qwen3", fetchImpl: async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    const message = bodies.length === 1
      ? { role: "assistant", content: "", tool_calls: [{ function: { name: "paid", arguments: {} } }] }
      : { role: "assistant", content: "The report is fictional." };
    return new Response(JSON.stringify({ message }), { status: 200 });
  } });
  const result = await runAgent({ model, prompt: "Get the report", tools: [{
    name: "paid", description: "Paid", parameters: { type: "object", properties: {} },
    async execute() { return "fictional report"; },
  }] });
  assert.equal(result.answer, "The report is fictional.");
  const first = bodies[0] as { stream: boolean; tools: Array<{ function: { name: string } }> };
  const second = bodies[1] as { messages: Array<{ role: string; tool_name?: string; content: string; tool_calls?: unknown[] }> };
  assert.equal(first.stream, false);
  assert.equal(first.tools[0].function.name, "paid");
  assert.equal(second.messages.at(-2)?.tool_calls?.length, 1);
  assert.deepEqual(second.messages.at(-1), { role: "tool", tool_name: "paid", content: "fictional report" });
});

test("LM Studio adapter keeps tool-call IDs across the paid tool round trip", async () => {
  const bodies: Array<{ model: string; messages: Array<Record<string, unknown>> }> = [];
  const model = new LmStudioChatModel({ model: "loaded-local-model", fetchImpl: async (url, init) => {
    assert.equal(String(url), "http://127.0.0.1:1234/v1/chat/completions");
    bodies.push(JSON.parse(String(init?.body)));
    const message = bodies.length === 1
      ? { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function",
          function: { name: "paid", arguments: "{}" } }] }
      : { role: "assistant", content: "The fictional report cost 300 units." };
    return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
  } });
  const result = await runAgent({ model, prompt: "Get the report", tools: [{
    name: "paid", description: "Paid", parameters: { type: "object", properties: {} },
    async execute() { return "fictional report"; },
  }] });
  assert.equal(result.answer, "The fictional report cost 300 units.");
  assert.equal(bodies[0].model, "loaded-local-model");
  assert.deepEqual(bodies[1].messages.at(-2)?.tool_calls, [{ id: "call_1", type: "function",
    function: { name: "paid", arguments: "{}" } }]);
  assert.deepEqual(bodies[1].messages.at(-1), {
    role: "tool", tool_call_id: "call_1", content: "fictional report",
  });
});
