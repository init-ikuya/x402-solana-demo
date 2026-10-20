import assert from "node:assert/strict";

export function assertDemoResource(value: unknown): asserts value is { reportId: string; headline: string } {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const report = value as Record<string, unknown>;
  assert.match(String(report.reportId), /^REPORT-[0-9A-F]{8}$/);
  assert.equal(report.fictional, true);
  assert.match(String(report.title), /Donald Trump Insider Brief/);
  assert.match(String(report.headline), /briefing/i);
  assert.match(String(report.lead), /CONFIDENTIAL/);
  assert.match(String(report.reveal), /announcement/);
  assert.match(String(report.disclaimer), /Fictional satire/);
}
