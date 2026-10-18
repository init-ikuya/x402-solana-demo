---
marp: true
theme: default
paginate: true
size: 16:9
lang: en
title: Auth-Capture on Solana
style: |
  section {
    background: #101f2b; color: #edf3f4; padding: 52px 64px 78px;
    font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif;
    font-size: 26px; line-height: 1.35; justify-content: flex-start;
  }
  section::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 7px; background: #72e2ba; }
  section::after { color: #8196a3; font-size: 15px; right: 40px; bottom: 24px; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: 78px; line-height: 1.03; letter-spacing: -3px; color: inherit; }
  h2 { font-size: 46px; line-height: 1.12; letter-spacing: -1.3px; color: inherit; margin: 14px 0 30px; }
  h3 { color: inherit; font-size: 28px; margin: 10px 0; }
  a { color: #72e2ba; text-decoration: none; }
  strong { color: inherit; }
  .eyebrow { font-size: 15px; letter-spacing: 3px; font-weight: 700; color: #72e2ba; text-transform: uppercase; }
  .muted { color: #a6b8c1; }
  .accent { color: #72e2ba; }
  .lead { font-size: 27px; line-height: 1.5; }
  .small { font-size: 19px; }
  .sources { position: absolute; bottom: 32px; left: 64px; right: 95px; font-size: 13px; line-height: 1.5; color: #a6b8c1; }
  .sources a { text-decoration: underline; }
  .grid { display: grid; gap: 20px; }
  .three { grid-template-columns: repeat(3, 1fr); }
  .two { grid-template-columns: 1fr 1fr; }
  .card { padding: 25px; border: 1px solid #3b4c58; border-radius: 16px; background: #182c39; }
  .card p { font-size: 22px; color: #b9c8cf; }
  .number { font-size: 48px; line-height: 1; font-weight: 700; color: #72e2ba; }
  .tag { display: inline-block; font-size: 14px; letter-spacing: 1px; border: 1px solid #4a6571; border-radius: 30px; padding: 7px 14px; }
  .band { margin-top: 25px; padding: 18px 24px; border-left: 4px solid #72e2ba; background: #182c39; font-size: 23px; }
  section.paper { background: #f4f2eb; color: #182b36; }
  section.paper .eyebrow, section.paper .number, section.paper .accent { color: #007e65; }
  section.paper .card { background: #fffefa; border-color: #d8ded7; }
  section.paper .card p, section.paper .muted, section.paper .sources { color: #50656e; }
  section.paper a { color: #006f5c; }
  section.paper .band { background: #e4eae1; border-color: #007e65; }
  .cover-layout { display: grid; grid-template-columns: 1.6fr 1fr; gap: 48px; align-items: center; margin-top: 42px; }
  .cover-sub { max-width: 650px; margin-top: 25px; font-size: 29px; color: #b9c8cf; }
  .cover-flow { display: grid; gap: 14px; }
  .cover-step { padding: 19px 24px; border: 1px solid #3b4c58; border-radius: 12px; font-size: 24px; }
  .cover-step span { color: #72e2ba; margin-right: 20px; font-size: 16px; }
  .date { margin-top: 42px; font-size: 20px; }
  .date span { color: #f6be76; }
  .http-layout { display: grid; grid-template-columns: 0.75fr 1.65fr; gap: 44px; align-items: start; }
  .http-code { font-size: 125px; font-weight: 750; letter-spacing: -7px; color: #007e65; line-height: 1; }
  .http-row { display: grid; grid-template-columns: 165px 1fr; gap: 12px; padding: 15px 0; border-bottom: 1px solid #cbd4cd; font-size: 21px; }
  .http-row b { color: #007e65; font-size: 18px; }
  .node { text-align: center; padding: 22px 16px; border: 1px solid #58727e; border-radius: 14px; background: #182c39; }
  .node b { font-size: 27px; }
  .node p { font-size: 18px; color: #b9c8cf; margin-top: 8px; }
  .arch-row { display: grid; grid-template-columns: 1fr 48px 1fr 48px 1fr; align-items: center; }
  .arrow { text-align: center; color: #72e2ba; font-size: 30px; }
  .chain-links { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 35px; margin: 16px 0; font-size: 20px; color: #72e2ba; text-align: center; }
  .chain { border-color: #72e2ba; background: #193d3e; }
  .demo-steps { display: grid; gap: 10px; margin-top: 24px; }
  .demo-steps div { padding: 9px 16px; border-left: 3px solid #72e2ba; background: #182c39; font-size: 20px; }
  .equation { display: grid; grid-template-columns: 1fr 50px 1fr 50px 1fr; align-items: center; margin: 8px 0 30px; text-align: center; }
  .equation b { display: block; font-size: 94px; line-height: 1.1; }
  .equation span { font-size: 18px; color: #b9c8cf; }
  .operator { font-size: 44px; color: #728c99; }
  .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .check { border-top: 2px solid #007e65; padding: 16px 0; }
  .check b { font-size: 25px; }
  .check p { font-size: 21px; color: #50656e; margin-top: 8px; }
  .status-table { width: 100%; border-collapse: collapse; font-size: 20px; margin: 8px 0 18px; }
  .status-table th, .status-table td { padding: 14px 12px; border-bottom: 1px solid #cbd4cd; text-align: left; background: transparent; }
  .status-table th { color: #007e65; font-size: 17px; }
  .scheme-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; }
  .scheme-grid .node { padding: 18px 10px; }
  .scheme-grid .node b { font-size: 21px; }
  .scheme-grid .node p { font-size: 17px; }
  .roadmap { display: grid; grid-template-columns: 0.95fr 1.45fr; gap: 35px; }
  .steps { display: grid; gap: 12px; }
  .step { border-bottom: 1px solid #3b4c58; padding: 10px 0; font-size: 23px; }
  .step span { color: #72e2ba; margin-right: 18px; }
---


<div class="eyebrow">Work in progress · Solana School / Demo Day</div>
<div class="cover-layout"><div><h1>Hold.<br>Capture.<br><span class="accent">Refund.</span></h1><p class="cover-sub">Designing auth-capture<br>for x402 on Solana.</p></div><div class="cover-flow"><div class="cover-step"><span>01</span> Agree on a spending ceiling</div><div class="cover-step"><span>02</span> Pay for the completed work</div><div class="cover-step"><span>03</span> Release or refund funds</div><p class="small muted">Independent Anchor prototype proposal<br>No claim of completed implementation</p></div></div>
<p class="date">October <span>19 or 21</span>, 2026 <span>· Date TBD · Draft</span></p>
<div class="sources">Lifecycle concept: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md">generic auth-capture specification</a> · <a href="ARCHITECTURE.md">Our Solana design</a></div>

---

<!-- _class: paper -->

<div class="eyebrow">01 / Solana auth-capture · Proposed design</div>

## A defined lifecycle.<br>A Solana binding to investigate.

<div class="grid two"><div class="card"><h3>What is specified</h3><p>Hold, capture, cancel, refund,<br>and client recovery after a deadline. [1]</p></div><div class="card"><h3>What we found</h3><p>No Solana auth-capture specification or SDK implementation in the reviewed official tree. [2, 3]</p></div></div>
<div class="band">Contribution target: a documented Solana binding and a tested Anchor prototype.</div>
<p class="small muted" style="margin-top:20px">This is a bounded search result, not a claim that nobody else is working on it.</p>
<div class="sources">[1] <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md">Generic specification</a> · [2] <a href="https://github.com/x402-foundation/x402/tree/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture">Scheme files</a> · [3] <a href="https://github.com/x402-foundation/x402/tree/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/typescript/packages/mechanisms/svm/src">SVM SDK source</a><br>x402 baseline cb0ec5b. Independent experimental binding, not official SVM compatibility.</div>

---

<div class="eyebrow">02 / Solana auth-capture · Proposed design</div>

## Who may move which funds?

<div class="arch-row"><div class="node"><b>Agent / client</b><p>Sets budget<br>Signs hold funding</p></div><div class="arrow">→</div><div class="node"><b>Gateway / merchant</b><p>Performs task<br>Signs capture and refund</p></div><div class="arrow">→</div><div class="node"><b>Facilitator</b><p>Sponsors transaction fees<br>Relays signed operations</p></div></div>
<div class="chain-links"><div>↓ direct reclaim</div><div>↓ authorized operations</div><div>↓ relay</div></div>
<div class="node chain"><b>Anchor program + payment PDA + hold vault</b><p>Validate signatures, deadlines, operation sequence, and amounts</p></div>
<div class="band">The facilitator cannot replace payer or merchant authorization.</div>
<p class="small muted" style="margin-top:18px">Current demo: the model calls a paid API tool; application code checks the budget and signs. Auth-capture support is planned.</p>
<div class="sources">Proposed Solana signer model: <a href="ARCHITECTURE.md#actors-and-trust-boundaries">Our architecture</a> · Current <a href="../../../examples/client/src/payment-tools.ts">paid API tools</a><br>Authority and refund-funding requirements: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md#network-requirements">generic specification</a>. Auth-capture is not implemented.</div>

---

<div class="eyebrow">03 / Solana auth-capture · Proposed design</div>

## Hold first. Finalize after the task.

<div class="arch-row"><div class="node"><b>Authorize</b><p>Client funds the hold<br>Wait for confirmation</p></div><div class="arrow">→</div><div class="node"><b>Execute task</b><p>Gateway records<br>success or failure</p></div><div class="arrow">→</div><div class="node"><b>Finalize</b><p>Capture actual + release rest<br>Or void remaining hold</p></div></div>
<div class="grid two" style="margin-top:25px"><div class="card"><h3>Service disappears?</h3><p>Client directly reclaims the remaining hold after the capture deadline.</p></div><div class="card"><h3>Later refund agreed?</h3><p>Merchant returns captured funds from its own token account.</p></div></div>
<div class="sources">Escrow ordering and lifecycle: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md">generic specification</a> · <a href="ARCHITECTURE.md#escrow-request-and-lifecycle-flow">Our sequence diagram</a><br>Capture cannot prove task quality. Reclaim does not reverse an already captured payment.</div>

---

<!-- _class: paper -->

<div class="eyebrow">04 / Solana auth-capture · Proposed design</div>

## Release and refund use different money.

<div class="grid three"><div class="card"><div class="number">1.0</div><h3>Hold</h3><p>Client → hold vault</p></div><div class="card"><div class="number">0.3 / 0.7</div><h3>Capture / release</h3><p>Vault → merchant / client</p></div><div class="card"><div class="number">0.1</div><h3>Later refund</h3><p>Merchant wallet → client</p></div></div>
<div class="band">Refunds require merchant consent and liquidity; they do not restore capture capacity.</div>
<p class="small muted" style="margin-top:20px">After the example: client has recovered 0.8, merchant retains 0.2, hold is empty.<br>Illustrative test-token amounts. Zero protocol fees; SOL network fees are separate.</p>
<div class="sources">Our accounting and funding choice: <a href="ARCHITECTURE.md#proposed-accounts-and-accounting">architecture</a><br>Refund funding is explicitly a binding requirement: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md#network-requirements">generic specification</a>. These are planned example balances.</div>

---

<!-- _class: paper -->

<div class="eyebrow">05 / Solana auth-capture · Proposed design</div>

## Test the lifecycle, not just a transfer.

<div class="checks"><div class="check"><b>01 · Authority</b><p>Reject wrong signers and changed<br>recipient, mint, or token accounts.</p></div><div class="check"><b>02 · Accounting</b><p>Bound captures by the hold;<br>bound refunds by captured funds.</p></div><div class="check"><b>03 · Time and replay</b><p>Test deadline boundaries,<br>duplicate funding and operations.</p></div><div class="check"><b>04 · Recovery</b><p>Test restart, timeout, abandonment,<br>and insufficient refund liquidity.</p></div></div>
<div class="band">A failed transfer must not advance the payment counters.</div>
<div class="sources">Planned acceptance criteria: <a href="ARCHITECTURE.md#acceptance-criteria-and-demo-evidence">Our validation plan</a><br>No completed payment tests or measured results are claimed.</div>

---

<div class="eyebrow">06 / Solana auth-capture · Proposed design</div>

## Start with escrow.<br>Track the remaining coverage.

<div class="roadmap"><div class="card"><span class="tag">TODAY · AUTH-CAPTURE DESIGN</span><h3>Anchor upto prototype</h3><p>Single-request escrow exists.<br>Auth-capture is still planned.</p></div><div class="steps"><div class="step"><span>01</span> Specify Solana terms and authority</div><div class="step"><span>02</span> Hold, capture, void, reclaim</div><div class="step"><span>03</span> Merchant-funded refund + recovery</div><div class="step"><span>04</span> Add direct charge flow separately</div></div></div>
<div class="band">An escrow demo is the first milestone, not full scheme completion.</div>
<div class="sources"><a href="../../../programs/anchoring-payment-channels/src/lib.rs">Current program</a> · <a href="ARCHITECTURE.md#binding-and-implementation-milestones">Our roadmap</a> · <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md">Scheme flows</a><br>Separate alternative presentation: <a href="../closing-settlement/slides.md">Issue #90</a>. Recheck public implementations before presenting.<br>Further reading: <a href="https://x402.org/wp-content/uploads/sites/10/2026/06/x402-whitepaper.pdf">x402 whitepaper</a> · <a href="https://github.com/x402-foundation/x402/tree/main/specs">x402 specifications</a></div>

---

<div class="eyebrow">Appendix / Running demo · Optional</div>

## Who calls whom in a paid API request?

<div class="arch-row"><div class="node"><b>Agent / client</b><p>Checks quote and budget<br>Signs the payment</p></div><div class="arrow">⇄</div><div class="node"><b>Gateway / API</b><p>Returns 402 and report<br>Calls the facilitator</p></div><div class="arrow">⇄</div><div class="node"><b>Facilitator</b><p>Checks authorization<br>Submits to Solana</p></div></div>
<div class="demo-steps"><div>1 · Client ↔ gateway: GET → 402 terms → signed retry.</div><div>2 · Gateway ↔ configured facilitator: exact verifies then settles; upto settles deposit then charge.</div><div>3 · Facilitator ↔ Solana: submit and confirm the transaction.</div><div>4 · Gateway → client: paid JSON + PAYMENT-RESPONSE.</div></div>
<div class="sources">Current demo architecture: <a href="../../demo-payment-architecture.md">roles and request sequences</a> · <a href="../../../examples/gateway/src/app.ts">gateway middleware</a> · <a href="../../../examples/client/src/payment-tools.ts">agent payment tools</a><br>This slide describes the running exact / upto demo; auth-capture remains a proposed design.</div>

---

<!-- _class: paper -->

<div class="eyebrow">Appendix / Q&amp;A · Optional</div>

## How does this demo use x402?

<div class="grid two">
<div class="card"><h3>Does the agent need a wallet?</h3><p>Yes. The app signs with a local Solana keypair. The model calls a paid API tool; it never receives the key.</p></div>
<div class="card"><h3>Which network do we use?</h3><p>The x402 FAQ lists Base and Solana. This demo uses Solana Devnet USDC; it has no EVM payment path.</p></div>
<div class="card"><h3>What does the facilitator do?</h3><p>It verifies and submits payments. This demo runs a separate local facilitator that sponsors transactions.</p></div>
<div class="card"><h3>Can x402 handle fiat or cards?</h3><p>Not natively. Third-party gateways can add those rails; this demo does not.</p></div>
</div>

<div class="sources">Official answers: <a href="https://docs.x402.org/faq">x402 FAQ</a> · <a href="https://docs.x402.org/core-concepts/facilitator">Facilitator</a><br>Demo implementation: <a href="../../../examples/client/src/agent.ts">agent</a> · <a href="../../../examples/client/src/payment-tools.ts">paid API tools</a> · <a href="../../../examples/gateway/src/run-facilitator.ts">local facilitator</a><br>Further reading: <a href="https://x402.org/wp-content/uploads/sites/10/2026/06/x402-whitepaper.pdf">x402 whitepaper</a> · <a href="https://github.com/x402-foundation/x402/tree/main/specs">x402 specifications</a></div>
