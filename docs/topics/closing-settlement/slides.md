---
marp: true
theme: default
paginate: true
size: 16:9
lang: en
title: Batch Settlement on Solana
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

<div class="eyebrow">Reference topic · Solana School / Demo Day</div>
<div class="cover-layout"><div><h1>One channel.<br>Many requests.<br><span class="accent">Settle later.</span></h1><p class="cover-sub">Batch settlement for an x402 paid API on Solana.</p></div>
<div class="cover-flow"><div class="cover-step"><span>01</span> Fund a payment channel</div><div class="cover-step"><span>02</span> Sign cumulative vouchers</div><div class="cover-step"><span>03</span> Claim and distribute later</div><p class="small muted">Official SVM SDK route integrated locally<br>Full on-chain payout still unverified</p></div></div>
<p class="date">Separate <span>batch-settlement reference deck</span></p>
<div class="sources">Binding: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md">x402 SVM specification</a> · <a href="../../../examples/gateway/README.md#batch-settlement-payment-flow">Our batch route</a></div>

---

<!-- _class: paper -->

<div class="eyebrow">01 / The idea</div>

## Repeated paid calls, one funded channel.

<div class="grid three">
<div class="card"><div class="number">01</div><h3>Deposit</h3><p>Client funds channel escrow once.</p></div>
<div class="card"><div class="number">02</div><h3>Vouchers</h3><p>Each paid call signs a higher cumulative total.</p></div>
<div class="card"><div class="number">03</div><h3>Payout</h3><p>Merchant claim and final distribution happen later.</p></div></div>
<div class="band">The latest accepted voucher is the claim; accepting it does not transfer tokens.</div>
<div class="sources">Sources: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md">SVM specification</a> · <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/typescript/packages/mechanisms/svm/src/batch-settlement/README.md">SDK guide</a><br>Protocol mechanics, not a measured fee or speed comparison.</div>

---

<div class="eyebrow">02 / Request and payout lifecycle</div>

## From HTTP 402 to deferred payout.

<div class="arch-row">
<div class="node"><b>Agent / client</b><p>Checks budget<br>Signs cumulative voucher</p></div><div class="arrow">→</div>
<div class="node"><b>Gateway</b><p>Returns 402 terms<br>Stores accepted state</p></div><div class="arrow">→</div>
<div class="node"><b>Facilitator</b><p>Verifies request<br>Submits later claim</p></div></div>
<div class="chain-links"><div>Channel deposit</div><div>Periodic redeem()</div><div>Claim / distribute</div></div>
<div class="node chain"><b>Foundation payment-channel program + escrow</b><p>Signed totals are bounded by the channel deposit</p></div>
<div class="band">A paid API response and an on-chain token payout are separate events.</div>
<div class="sources">Our path: <a href="../../../examples/client/src/batch-client.ts">client</a> · <a href="../../../examples/gateway/src/app.ts">HTTP route</a> · <a href="../../../examples/gateway/src/main.ts">redemption worker</a> · <a href="../../../examples/gateway/src/run-facilitator.ts">facilitator</a><br>Full deposit-to-distribution execution is not yet verified in this repository.</div>

---

<!-- _class: paper -->

<div class="eyebrow">03 / Implemented in this repository</div>

## The official SDK route is wired in.

<div class="grid two">
<div class="card"><h3>Client and agent</h3><p>Choose the batch quote, reuse a stored channel, sign vouchers, and expose a refund command.</p></div>
<div class="card"><h3>Gateway and facilitator</h3><p>Advertise batch terms, persist channel and pending state, and start a periodic redemption worker.</p></div></div>
<div class="band">Opt-in /api/trump-insider/batch · @x402/svm 2.28.0 · Solana Devnet USDC</div>
<p class="small muted" style="margin-top:18px">This route targets the Foundation channel program. The repository's Anchor program backs the separate upto flow.</p>
<div class="sources"><a href="../../../examples/client/src/payment-tools.ts">Agent tools</a> · <a href="../../../examples/client/src/batch-client.ts">Client store</a> · <a href="../../../examples/gateway/src/batch-store.ts">Gateway store</a> · <a href="../../../examples/gateway/src/batch-facilitator-store.ts">Facilitator stores</a></div>

---

<div class="eyebrow">04 / What we have verified</div>

## Local evidence has a clear boundary.

<div class="grid two">
<div class="card"><h3>Verified locally</h3><p>402 advertises the official client-signed channel binding. Facilitator forwarding and durable stores have tests.</p></div>
<div class="card"><h3>Still to verify</h3><p>Repeated paid calls, a complete claim and distribution, refunds, and live Devnet balances.</p></div></div>
<div class="band">30 TypeScript payment tests passed; this is not a verified on-chain batch payout.</div>
<div class="sources"><a href="../../../examples/gateway/test/batch-route.test.ts">Route test</a> · <a href="../../../examples/gateway/test/batch-store.test.ts">Gateway storage test</a> · <a href="../../../examples/client/test/batch-client-store.test.ts">Client storage test</a><br>Results are local; retain the test output and commit for the presentation.</div>

---

<!-- _class: paper -->

<div class="eyebrow">05 / Next resilience question</div>

## What if the facilitator is offline at Closing?

<div class="grid three">
<div class="card"><div class="number">01</div><h3>Work served</h3><p>Merchant holds a valid, unsettled voucher.</p></div>
<div class="card"><div class="number">02</div><h3>Client closes</h3><p>The channel enters Closing and a grace period begins.</p></div>
<div class="card"><div class="number">03</div><h3>Claim blocked</h3><p>At the pinned baseline, ordinary settle accepts Open only.</p></div></div>
<div class="band">Issue #90 proposes merchant submission before the deadline. It remains a separate design.</div>
<div class="sources"><a href="https://github.com/solana-foundation/payment-channels/issues/90">Issue #90</a> · <a href="https://github.com/solana-foundation/payment-channels/blob/3ffa4d6728ad88e4a9667a76ad9ccd68a302c696/program/payment_channels/src/instructions/settle.rs">Pinned Open-only settle</a> · <a href="ARCHITECTURE.md#design-focus-issue-90-planned">Our proposed experiment</a><br>Recheck upstream status before presenting. No recovery claim is made for this demo.</div>

---

<div class="eyebrow">06 / Next milestone</div>

## Prove the whole money path.

<div class="roadmap"><div class="card"><span class="tag">TODAY · LOCAL SDK INTEGRATION</span><h3>Batch route + stores</h3><p>402, forwarding, and persistence tests pass. On-chain payout remains unverified.</p></div><div class="steps"><div class="step"><span>01</span> Fund a Devnet channel</div><div class="step"><span>02</span> Make repeated paid calls</div><div class="step"><span>03</span> Confirm claim and distribution</div><div class="step"><span>04</span> Reconcile token balances</div></div></div>
<div class="band">After that, test Closing recovery separately against Issue #90.</div>
<div class="sources"><a href="../../../examples/gateway/README.md#batch-settlement-payment-flow">Runbook</a> · <a href="ARCHITECTURE.md#demonstration-and-acceptance-criteria">Recovery validation plan</a><br>Exact, upto, and auth-capture remain in the wider project scope.</div>

---

<div class="eyebrow">Appendix / Batch request · Optional</div>

## What does one paid request do?

<div class="demo-steps"><div>1 · Client GET → gateway returns 402 with batch channel terms.</div><div>2 · Client checks budget and channel, signs a cumulative voucher, retries.</div><div>3 · Gateway verifies through facilitator and stores accepted state.</div><div>4 · Gateway returns paid JSON; worker claims and distributes later.</div></div>
<div class="band">The model chooses the tool. Application code owns the key and spending limit.</div>
<div class="sources"><a href="../../demo-payment-architecture.md">Request architecture</a> · <a href="../../../examples/client/src/batch-client.ts">Client</a> · <a href="../../../examples/gateway/src/app.ts">Gateway</a><br>Step 4 describes the wired path, not an observed full payout.</div>

---

<!-- _class: paper -->

<div class="eyebrow">Appendix / Q&amp;A · Optional</div>

## Which parts are official, local, and planned?

<div class="grid two">
<div class="card"><h3>Official binding</h3><p>The opt-in batch route uses @x402/svm and the Foundation channel program.</p></div>
<div class="card"><h3>Local evidence</h3><p>HTTP challenge, facilitator forwarding, durable stores, and TypeScript tests.</p></div>
<div class="card"><h3>Unverified outcome</h3><p>Complete on-chain batch payout and Devnet balance reconciliation.</p></div>
<div class="card"><h3>Separate proposal</h3><p>Issue #90 Closing recovery in an independent Anchor experiment.</p></div></div>
<div class="sources"><a href="../../../examples/gateway/README.md#batch-settlement-payment-flow">Demo guide</a> · <a href="ARCHITECTURE.md">Recovery design</a></div>
