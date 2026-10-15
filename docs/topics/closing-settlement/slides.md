---
marp: true
theme: default
paginate: true
size: 16:9
lang: en
title: Anchoring Payment Channels
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


<div class="eyebrow">Solana School · Fall Class / Demo Day</div>
<div class="cover-layout"><div><h1>Keep the<br>settlement<br><span class="accent">path open.</span></h1><p class="cover-sub">Recovering batch payments<br>when the facilitator is unavailable.</p></div>
<div class="cover-flow"><div class="cover-step"><span>01</span> Client requests closure</div><div class="cover-step"><span>02</span> Facilitator goes offline</div><div class="cover-step"><span>03</span> Merchant settles directly</div><p class="small muted">Solana x402 · Independent Anchor experiment<br>Design stage, not an implemented result</p></div></div>
<p class="date">October <span>19 or 21</span>, 2026 <span>· Date TBD</span></p>
<div class="sources">Proposed recovery path: <a href="https://github.com/solana-foundation/payment-channels/issues/90">payment-channels #90</a> · <a href="ARCHITECTURE.md#design-focus-issue-90-planned">Our architecture</a></div>

---

<!-- _class: paper -->

<div class="eyebrow">01 / Issue #90 · Planned experiment</div>

## An existing protocol.<br>A specific recovery gap.

<div class="grid two">
<div class="card"><h3>x402 batch-settlement</h3><p>Signed requests accumulate off-chain.<br>The merchant redeems later. [1]</p></div>
<div class="card"><h3>Existing foundation</h3><p>Solana specification and SDK exist. [1, 2]<br>The channel program reports mainnet operation. [3]</p></div></div>
<div class="band">Focus: merchant recovery during Closing when the facilitator is unavailable. [4]</div>
<p class="small muted" style="margin-top:18px">Repository scope stays all four schemes. This talk examines one improvement.</p>
<div class="sources">[1] <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md">SVM specification</a> · [2] <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/typescript/packages/mechanisms/svm/src/batch-settlement/README.md">SDK</a> · [3] <a href="https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md">Foundation status</a> · [4] <a href="https://github.com/solana-foundation/payment-channels/issues/90">Issue #90</a><br>Pinned source snapshots; recheck current status before presenting. Published code and deployment reports are not an independent stability assessment.</div>

---

<div class="eyebrow">02 / Issue #90 · Planned experiment</div>

## Three actors. Two different authorities.

<div class="arch-row">
<div class="node"><b>Agent / client</b><p>Funds the channel<br>Signs payment vouchers</p></div><div class="arrow">→</div>
<div class="node"><b>Gateway / merchant</b><p>Serves the API<br>Stores the latest voucher</p></div><div class="arrow">→</div>
<div class="node"><b>Facilitator</b><p>Channel payee authority<br>Signs cooperative closure</p></div></div>
<div class="chain-links"><div>↓ request_close</div><div>↓ proposed direct settle</div><div>↓ settle_and_seal</div></div>
<div class="node chain"><b>Solana program + channel state + escrow</b><p>Validate authorization · record settlement · distribute funds separately</p></div>
<div class="band">In this arrangement, the merchant receives payment; the facilitator holds the payee role.</div>
<p class="small muted" style="margin-top:18px">Current demo: the model calls a paid API tool; application code checks the budget and signs. Batch support is planned.</p>
<div class="sources">Role split: <a href="https://github.com/solana-foundation/payment-channels/issues/90">#90 context</a> · <a href="https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions">On-chain operations</a><br>Current tool implementation: <a href="../../../examples/client/src/payment-tools.ts">exact / upto demo</a>. The fallback needs its own RPC connection and SOL fee payer.</div>

---

<!-- _class: paper -->

<div class="eyebrow">03 / Issue #90 · Planned experiment</div>

## Closing currently blocks direct settlement.

<div class="grid three">
<div class="card"><div class="number">01</div><h3>Work completed</h3><p>The merchant holds a valid voucher that is not yet settled.</p></div>
<div class="card"><div class="number">02</div><h3>Closure requested</h3><p>The client calls request_close.<br>The grace period begins.</p></div>
<div class="card"><div class="number">03</div><h3>Facilitator offline</h3><p>Normal settle rejects Closing.<br>The merchant cannot use that route.</p></div></div>
<div class="band">Existing alternative: payee-signed settle_and_seal before the deadline.</div>
<div class="sources">Baseline code: <a href="https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs">Open-only settle</a> · <a href="https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle_and_seal.rs">payee-signed settle_and_seal</a><br>Scenario follows <a href="https://github.com/solana-foundation/payment-channels/issues/90">Issue #90</a>. Baseline commit: 3ffa4d6. Not a measured outage.</div>

---

<div class="eyebrow">04 / Issue #90 · Planned experiment</div>

## Add a deadline-bounded recovery route.

<div class="arch-row"><div class="node"><b>Gateway worker</b><p>Load the saved voucher<br>Submit directly</p></div><div class="arrow">→</div><div class="node"><b>Program checks</b><p>Closing + before deadline<br>Valid signature + bounded total</p></div><div class="arrow">→</div><div class="node"><b>Record settlement</b><p>Update settled amount<br>Remain Closing</p></div></div>
<div class="band">After the deadline: seal → distribute payment and unused-fund refund.</div>
<p class="small muted" style="margin-top:22px">At or after the deadline, direct settle fails. It also fails if sealing has already won the race.<br>Recording settlement does not itself transfer tokens or extend the deadline.</p>
<div class="sources">Changed state gate: <a href="https://github.com/solana-foundation/payment-channels/issues/90">#90 proposal</a> · <a href="https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/README.md#instructions">Separate seal / distribute operations</a><br>Our design: independent Anchor deployment, not an upgrade of the canonical program.</div>

---

<!-- _class: paper -->

<div class="eyebrow">05 / Issue #90 · Planned experiment</div>

## Make the difference observable.

<div class="checks">
<div class="check"><b>01 · Same outage scenario</b><p>Baseline rejects Closing settle.<br>Modified gate accepts before expiry.</p></div>
<div class="check"><b>02 · Exact time boundary</b><p>Before deadline: accept valid voucher.<br>At or after deadline: reject.</p></div>
<div class="check"><b>03 · Authorization remains</b><p>Reject wrong signatures, excess amounts,<br>expired and repeated vouchers.</p></div>
<div class="check"><b>04 · Correct final balances</b><p>Record first; pay through distribution.<br>Verify one payment and the refund.</p></div></div>
<div class="band">Also test restart, unknown transaction outcomes, and sealing before recovery.</div>
<div class="sources">Proposed acceptance criteria: <a href="ARCHITECTURE.md#demonstration-and-acceptance-criteria">Our validation plan</a> · Constraints: <a href="https://github.com/solana-foundation/payment-channels/issues/90">Issue #90</a><br>These are planned tests, not passing results.</div>

---

<div class="eyebrow">06 / Issue #90 · Planned experiment</div>

## One focused experiment.<br>Four schemes remain in scope.

<div class="roadmap"><div class="card"><span class="tag">TODAY · #90 DESIGN STAGE</span><h3>Anchor upto prototype</h3><p>Single-request escrow exists.<br>Closing recovery is planned.</p></div><div class="steps"><div class="step"><span>01</span> Reproduce baseline lifecycle</div><div class="step"><span>02</span> Implement the #90 state gate</div><div class="step"><span>03</span> Compare behavior and balances</div><div class="step"><span>04</span> Demonstrate with facilitator offline</div></div></div>
<div class="band">Contribution target: reduce facilitator dependence during the Closing grace period.</div>
<div class="sources"><a href="../../../programs/anchoring-payment-channels/src/lib.rs">Current program</a> · <a href="../../ARCHITECTURE.md">Four-scheme scope and #90 design</a><br>Recheck upstream PRs before implementation. No claim of guaranteed recovery after sealing.<br>Further reading: <a href="https://x402.org/wp-content/uploads/sites/10/2026/06/x402-whitepaper.pdf">x402 whitepaper</a> · <a href="https://github.com/x402-foundation/x402/tree/main/specs">x402 specifications</a></div>

---

<div class="eyebrow">Appendix / Running demo · Optional</div>

## Who calls whom in a paid API request?

<div class="arch-row"><div class="node"><b>Agent / client</b><p>Checks quote and budget<br>Signs the payment</p></div><div class="arrow">⇄</div><div class="node"><b>Gateway / API</b><p>Returns 402 and report<br>Calls the facilitator</p></div><div class="arrow">⇄</div><div class="node"><b>Facilitator</b><p>Checks authorization<br>Submits to Solana</p></div></div>
<div class="demo-steps"><div>1 · Client ↔ gateway: GET → 402 terms → signed retry.</div><div>2 · Gateway ↔ configured facilitator: exact verifies then settles; upto settles deposit then charge.</div><div>3 · Facilitator ↔ Solana: submit and confirm the transaction.</div><div>4 · Gateway → client: paid JSON + PAYMENT-RESPONSE.</div></div>
<div class="sources">Current demo architecture: <a href="../../demo-payment-architecture.md">roles and request sequences</a> · <a href="../../../examples/gateway/src/app.ts">gateway middleware</a> · <a href="../../../examples/client/src/payment-tools.ts">agent payment tools</a><br>This slide describes the running exact / upto demo; the Issue #90 recovery path remains planned.</div>

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
