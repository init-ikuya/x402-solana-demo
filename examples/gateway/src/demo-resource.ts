import { randomUUID } from "node:crypto";

/** The paid resource is independent of the selected payment scheme. */
export const DEMO_RESOURCE_PATH = "/api/trump-insider";
export const UPTO_RESOURCE_PATH = `${DEMO_RESOURCE_PATH}/upto`;
export const DEMO_RESOURCE_DESCRIPTION = "Donald Trump insider information — a fictional parody API";

export function getDemoResource() {
  return {
    reportId: `FICTION-${randomUUID().slice(0, 8).toUpperCase()}`,
    title: "Donald Trump Insider Brief — Palm Beach Desk",
    fictional: true,
    source: "An entirely invented aide's private scheduling note",
    headline: "A closed-door Palm Beach briefing may precede a surprise media rollout",
    lead: "The fictional run-of-show reserves 8:15 p.m. for a 'major announcement' and marks the subject line CONFIDENTIAL.",
    detail: "One draft places gold-embossed invitations at the door and asks staff to keep the teleprompter covered until the cameras arrive.",
    reveal: "The supposed secret is the date of another announcement about a future announcement.",
    disclaimer: "Fictional satire generated for this payment demo. No real sources, non-public information, or investment advice.",
  };
}
