---
marp: true
theme: default
paginate: true
size: 16:9
lang: en
title: Auth-Capture on Solana
style: |
  section {
    background: #110e20; color: #f5f0ff; padding: 52px 64px 78px;
    font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif;
    font-size: 26px; line-height: 1.35; justify-content: flex-start;
    box-shadow: inset 0 7px 0 #a875ed;
  }
  section::before {
    content: '@init-ikuya'; position: absolute; top: 17px; right: 40px;
    height: 30px; padding-left: 38px; line-height: 30px;
    background: url('assets/github-avatar.jpg') left center / 30px 30px no-repeat;
    color: #c8b9e3; font-size: 15px; font-weight: 600; letter-spacing: 0;
  }
  section::after { color: #a99abe; font-size: 15px; right: 40px; bottom: 24px; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: 78px; line-height: 1.03; letter-spacing: -3px; color: inherit; }
  h2 { font-size: 46px; line-height: 1.12; letter-spacing: -1.3px; color: inherit; margin: 14px 0 30px; }
  h3 { color: inherit; font-size: 28px; margin: 10px 0; }
  a { color: #caa9ff; text-decoration: none; }
  strong { color: inherit; }
  .eyebrow { font-size: 15px; letter-spacing: 3px; font-weight: 700; color: #caa9ff; text-transform: uppercase; }
  .muted { color: #c1b7d5; }
  .accent { color: #caa9ff; }
  .lead { font-size: 27px; line-height: 1.5; }
  .small { font-size: 19px; }
  .sources { position: absolute; bottom: 32px; left: 64px; right: 95px; font-size: 13px; line-height: 1.5; color: #b6a9ce; }
  .sources a { text-decoration: underline; }
  .grid { display: grid; gap: 20px; }
  .three { grid-template-columns: repeat(3, 1fr); }
  .two { grid-template-columns: 1fr 1fr; }
  .card { padding: 25px; border: 1px solid #55446f; border-radius: 16px; background: #211a36; }
  .card p { font-size: 22px; color: #cec4df; }
  .number { font-size: 48px; line-height: 1; font-weight: 700; color: #caa9ff; }
  .tag { display: inline-block; font-size: 14px; letter-spacing: 1px; border: 1px solid #8166aa; border-radius: 30px; padding: 7px 14px; }
  .band { margin-top: 25px; padding: 18px 24px; border-left: 4px solid #b783f4; background: #271e3d; font-size: 23px; }
  section.paper { background: #1d1730; color: #f5f0ff; }
  section.paper .card { background: #2a2041; border-color: #655080; }
  section.paper .card p, section.paper .muted, section.paper .sources { color: #cec4df; }
  section.paper .band { background: #31254b; }
  section.appendix-divider, section.demo-divider {
    background: radial-gradient(circle at center, #32204e 0%, #110e20 72%);
    justify-content: center; align-items: center; text-align: center; padding: 0;
  }
  section.appendix-divider h1, section.demo-divider h1 { font-size: 96px; letter-spacing: -2px; }
  section.appendix-divider::before, section.appendix-divider::after,
  section.demo-divider::before, section.demo-divider::after { display: none; }
  .cover-layout { display: grid; grid-template-columns: 1.6fr 1fr; gap: 48px; align-items: center; margin-top: 42px; }
  .cover-sub { max-width: 650px; margin-top: 25px; font-size: 29px; color: #cec4df; }
  .presenter { margin-top: 24px; color: #caa9ff; font-size: 20px; letter-spacing: 0.4px; }
  .cover-flow { display: grid; gap: 14px; }
  .cover-step { padding: 14px 20px; border: 1px solid #55446f; border-radius: 12px; font-size: 23px; background: #211a36; }
  .cover-step span { color: #caa9ff; margin-right: 16px; font-size: 16px; }
  .cover-profile { display: flex; align-items: center; gap: 17px; margin-top: 4px; padding: 11px; border: 1px solid #765d9e; border-radius: 14px; background: #2a2041; }
  .cover-profile img { width: 154px; height: 154px; flex: none; padding: 6px; border-radius: 8px; background: #fff; }
  .cover-profile b { display: block; font-size: 22px; }
  .cover-profile p { margin-top: 7px; font-size: 16px; color: #cec4df; }
  .cover-profile a { font-size: 15px; overflow-wrap: anywhere; }
  .date { margin-top: 42px; font-size: 20px; }
  .date span { color: #e5a8ec; }
  .http-layout { display: grid; grid-template-columns: 0.75fr 1.65fr; gap: 44px; align-items: start; }
  .http-code { font-size: 125px; font-weight: 750; letter-spacing: -7px; color: #caa9ff; line-height: 1; }
  .http-row { display: grid; grid-template-columns: 165px 1fr; gap: 12px; padding: 15px 0; border-bottom: 1px solid #655080; font-size: 21px; }
  .http-row b { color: #caa9ff; font-size: 18px; }
  .node { text-align: center; padding: 22px 16px; border: 1px solid #655080; border-radius: 14px; background: #211a36; }
  .node b { font-size: 27px; }
  .node p { font-size: 18px; color: #cec4df; margin-top: 8px; }
  .arch-row { display: grid; grid-template-columns: 1fr 48px 1fr 48px 1fr; align-items: center; }
  .arrow { text-align: center; color: #caa9ff; font-size: 30px; }
  .chain-links { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 35px; margin: 16px 0; font-size: 20px; color: #caa9ff; text-align: center; }
  .chain { border-color: #b783f4; background: #302044; }
  .demo-steps { display: grid; gap: 10px; margin-top: 24px; }
  .demo-steps div { padding: 9px 16px; border-left: 3px solid #b783f4; background: #211a36; font-size: 20px; }
  .sequence-slide { position: relative; margin: -6px 18px 0; padding: 0 75px; }
  .sequence-slide::before, .sequence-slide::after { content: ''; position: absolute; top: 45px; bottom: 0; border-left: 2px dashed #795d9e; }
  .sequence-slide::before { left: 75px; }
  .sequence-slide::after { right: 75px; }
  .sequence-actors { display: flex; justify-content: space-between; margin: 0 -75px 7px; color: #d7c1f7; font-size: 18px; font-weight: 700; }
  .sequence-actors span:last-child { text-align: right; }
  .sequence-slide-row { position: relative; isolation: isolate; height: 55px; text-align: center; font-size: 20px; }
  .sequence-slide-row b { display: inline-block; padding: 0 8px; background: #110e20; color: #f5f0ff; }
  .sequence-slide-row small { margin-left: 8px; color: #caa9ff; font-size: 16px; }
  .sequence-slide-row::before { content: ''; position: absolute; z-index: -1; top: 35px; left: 0; right: 0; border-top: 3px solid #b783f4; }
  .sequence-slide-row::after { content: '▶'; position: absolute; top: 22px; right: -7px; color: #caa9ff; font-size: 24px; }
  .sequence-slide-row.reverse::after { content: '◀'; left: -7px; right: auto; }
  .sequence-slide-row.internal::before { left: 78%; border-radius: 12px; border: 3px solid #b783f4; border-left: 0; height: 15px; top: 30px; }
  .sequence-slide-row.internal::after { content: '◀'; right: 23%; top: 34px; }
  .sequence-slide-row.refund b { color: #e7bcff; }
  .sequence-note { margin-top: 8px; padding: 11px 15px; border-left: 3px solid #b783f4; background: #211a36; color: #d9cde9; font-size: 17px; }
  .equation { display: grid; grid-template-columns: 1fr 50px 1fr 50px 1fr; align-items: center; margin: 8px 0 30px; text-align: center; }
  .equation b { display: block; font-size: 94px; line-height: 1.1; }
  .equation span { font-size: 18px; color: #cec4df; }
  .operator { font-size: 44px; color: #ac99c5; }
  .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .check { border-top: 2px solid #b783f4; padding: 16px 0; }
  .check b { font-size: 25px; }
  .check p { font-size: 21px; color: #cec4df; margin-top: 8px; }
  .status-table { width: 100%; border-collapse: collapse; font-size: 20px; margin: 8px 0 18px; }
  .status-table th, .status-table td { padding: 14px 12px; border-bottom: 1px solid #655080; text-align: left; background: transparent; }
  .status-table th { color: #caa9ff; font-size: 17px; }
  .scheme-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; }
  .scheme-grid .node { padding: 18px 10px; }
  .scheme-grid .node b { font-size: 21px; }
  .scheme-grid .node p { font-size: 17px; }
  .roadmap { display: grid; grid-template-columns: 0.95fr 1.45fr; gap: 35px; }
  .steps { display: grid; gap: 12px; }
  .step { border-bottom: 1px solid #655080; padding: 10px 0; font-size: 23px; }
  .step span { color: #caa9ff; margin-right: 18px; }
---


<div class="eyebrow">Main topic · Solana School / Demo Day</div>
<div class="cover-layout"><div><h1>Hold.<br>Capture.<br><span class="accent">Refund.</span></h1><p class="cover-sub">An experimental auth-capture<br>escrow flow for x402 on Solana.</p><p class="presenter">@init-ikuya · Japanese developer</p></div><div class="cover-flow"><div class="cover-step"><span>01</span> Agree on a spending ceiling</div><div class="cover-step"><span>02</span> Pay for the completed work</div><div class="cover-step"><span>03</span> Release or refund funds</div><div class="cover-profile"><img src="assets/github-profile-qr.png" alt="QR code for github.com/init-ikuya"><div><b>Follow the project</b><p>Scan for my GitHub profile</p><a href="https://github.com/init-ikuya">github.com/init-ikuya</a></div></div></div></div>
<p class="date">Demo Day <span>· October 20, 2026</span></p>
<div class="sources">References: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md">generic auth-capture specification</a> · <a href="ARCHITECTURE.md">Our Solana design</a></div>

---

<!-- _class: paper -->

<div class="eyebrow">01 / Solana auth-capture · Escrow prototype</div>

## The specification defaults to escrow.<br>We implemented that flow on Solana.

<div class="grid two"><div class="card"><h3>Escrow · default</h3><p><code>authorize</code> holds the ceiling. After the resource runs: <code>capture</code> or <code>void</code>. Later: <code>refund</code>; payer <code>reclaim</code> after the capture deadline. [1]</p></div><div class="card"><h3>Authorization · alternative</h3><p>Verify before the resource; <code>charge</code> afterwards. A later <code>refund</code> is possible. No hold, capture, void, or reclaim. [1]</p></div></div>
<div class="band">Our Anchor binding implements the default escrow flow: hold, partial capture, release, refund, and payer reclaim.</div>
<p class="small muted" style="margin-top:14px">Official auth-capture SDK support exists for EVM; none was published for SVM in the reviewed snapshot. [2, 3]</p>
<div class="sources">[1] <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md">Generic specification, payment flows</a> · [2] <a href="https://github.com/x402-foundation/x402/tree/faa1c694c66a3732aaabbce93bdae140e521a67d/typescript/packages/mechanisms/evm/src/auth-capture">EVM SDK source</a> · [3] <a href="https://github.com/x402-foundation/x402/tree/faa1c694c66a3732aaabbce93bdae140e521a67d/typescript/packages/mechanisms/svm/src">SVM SDK source</a><br>SDK snapshot faa1c69 (2026-10-15). Independent experimental binding; no official SVM compatibility claim.</div>

---

<div class="eyebrow">02 / Solana auth-capture · Escrow prototype</div>

## Who may move which funds?

<div class="arch-row"><div class="node"><b>Agent / client</b><p>Checks budget<br>Signs hold funding</p></div><div class="arrow">→</div><div class="node"><b>Gateway / merchant</b><p>Performs task<br>Signs capture and refund</p></div><div class="arrow">→</div><div class="node"><b>Facilitator</b><p>Sponsors fees<br>Relays in-request transactions</p></div></div>
<div class="chain-links"><div>↓ direct reclaim</div><div>↓ authorized operations</div><div>↓ relay</div></div>
<div class="node chain"><b>Anchor program + payment PDA + hold vault</b><p>Validate signatures, deadlines, operation sequence, and amounts</p></div>
<div class="band">The facilitator cannot replace payer or merchant authorization.</div>
<p class="small muted" style="margin-top:18px">The browser agent runs the paid request. Later refunds and payer reclaim are separate operations. The model never receives keys.</p>
<div class="sources">Signer model: <a href="ARCHITECTURE.md#actors-and-trust-boundaries">architecture</a> · <a href="../../../examples/client/src/payment-tools.ts">paid API tools</a><br>Authority and refund-funding requirements: <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md#network-requirements">generic specification</a>.</div>

---

<!-- _class: demo-divider -->

# DEMO

---

<div class="eyebrow">03 / Default escrow flow · settle → resource → settle</div>

## Follow the client–provider exchange.

<div class="sequence-slide"><div class="sequence-actors"><span>AI AGENT / CLIENT</span><span>API PROVIDER / MERCHANT</span></div><div class="sequence-slide-row"><b>01 · GET paid report</b></div><div class="sequence-slide-row reverse"><b>02 · 402 Payment Required</b><small>Hold ceiling: 1000</small></div><div class="sequence-slide-row"><b>03 · Signed retry</b><small>Payer authorizes the hold</small></div><div class="sequence-slide-row internal"><b>04 · Capture 300, release 700</b></div><div class="sequence-slide-row reverse"><b>05 · 200 + PAYMENT-RESPONSE</b></div><div class="sequence-slide-row reverse refund"><b>06 · Later merchant refund: 100</b></div></div>
<div class="sequence-note">The model selects the tool and later judges the report. The app handles signatures and budget; the facilitator relays the in-request transactions. On failure, the merchant voids the hold; after abandonment, the payer may reclaim the remainder.</div>
<div class="sources">Browser sequence: <a href="demo.md#browser-presentation">recorded demo</a> · Escrow ordering: <a href="https://github.com/x402-foundation/x402/blob/cb0ec5bca0a5b21860a36bb60f34433c2e8e0d71/specs/schemes/auth-capture/scheme_auth_capture.md">generic specification</a> · <a href="ARCHITECTURE.md#escrow-request-and-lifecycle-flow">full protocol diagram</a><br>Capture cannot prove task quality. Reclaim does not reverse an already captured payment.</div>

---

<!-- _class: paper -->

<div class="eyebrow">04 / Solana auth-capture · Accounting</div>

## Release and refund use different money.

<div class="grid three"><div class="card"><div class="number">1000</div><h3>Hold</h3><p>Client → hold vault</p></div><div class="card"><div class="number">300 / 700</div><h3>Capture / release</h3><p>Vault → merchant / client</p></div><div class="card"><div class="number">100</div><h3>Later refund</h3><p>Merchant wallet → client</p></div></div>
<div class="band">Refund request: app-defined, off-chain or on-chain. Merchant-approved return: on-chain in our binding.</div>
<p class="small muted" style="margin-top:20px">The recording shows a manual merchant refund, not a buyer request. Merchant consent and liquidity are required.<br>Client recovered 800 units; merchant retains 200. Atomic USDC units (1000 = 0.001 USDC); SOL fees are separate.</p>
<div class="sources">Accounting: <a href="ARCHITECTURE.md#accounts-and-accounting">architecture</a> · <a href="../../../programs/anchoring-payment-channels/tests/test_auth_capture.rs">LiteSVM tests</a><br>Refund funding is a binding requirement: <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md#network-requirements">generic specification</a>. Amounts are illustrative atomic units.</div>

---

<!-- _class: paper -->

<div class="eyebrow">05 / Solana auth-capture · Local evidence</div>

## Test the lifecycle, not just a transfer.

<div class="checks"><div class="check"><b>01 · Authority</b><p>Reject wrong signers and changed<br>recipient, mint, or token accounts.</p></div><div class="check"><b>02 · Accounting</b><p>Bound captures by the hold;<br>bound refunds by captured funds.</p></div><div class="check"><b>03 · Time and replay</b><p>Test deadline boundaries,<br>duplicate funding and operations.</p></div><div class="check"><b>04 · Recovery</b><p>Test restart, timeout, abandonment,<br>and insufficient refund liquidity.</p></div></div>
<div class="band">A failed transfer must not advance the payment counters.</div>
<div class="sources">Local evidence: validator recording with confirmed balance changes · <a href="../../../programs/anchoring-payment-channels/tests/test_auth_capture.rs">LiteSVM tests</a> · <a href="../../../examples/gateway/test/anchor-auth-capture.integration.test.ts">HTTP integration test</a><br>Live Devnet balance reconciliation remains unverified.</div>

---

<div class="eyebrow">06 / Solana auth-capture · Scope</div>

## Escrow implemented.<br>Devnet payment to verify.

<div class="roadmap"><div class="card"><span class="tag">IMPLEMENTED · ESCROW</span><h3>Working prototype</h3><p>Anchor program, HTTP adapter, and browser-driven AI agent payment.</p></div><div class="steps"><div class="step"><span>✓</span> Hold, capture, void, reclaim</div><div class="step"><span>✓</span> Merchant-funded refund</div><div class="step"><span>✓</span> Program deployed on Devnet</div><div class="step"><span>→</span> Verify a Devnet payment</div></div></div>
<div class="band">Experimental escrow binding; the alternative authorization / direct-charge flow is outside this implementation.</div>
<div class="sources"><a href="../../../programs/anchoring-payment-channels/src/auth_capture.rs">Anchor program</a> · <a href="ARCHITECTURE.md#binding-and-implementation-milestones">Roadmap</a> · <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md">Scheme flows</a><br>The separate <a href="../closing-settlement/ARCHITECTURE.md">Issue #90 design</a> does not define this binding.</div>

---

<!-- _class: appendix-divider -->

# Appendix

---

<div class="eyebrow">Appendix / Running demo · Optional</div>

## Who calls whom in a paid API request?

<div class="arch-row"><div class="node"><b>Agent / client</b><p>Checks quote and budget<br>Signs the payment</p></div><div class="arrow">⇄</div><div class="node"><b>Gateway / API</b><p>Returns 402 and report<br>Calls the facilitator</p></div><div class="arrow">⇄</div><div class="node"><b>Facilitator</b><p>Checks authorization<br>Submits to Solana</p></div></div>
<div class="demo-steps"><div>1 · Client → gateway: GET; gateway → client: auth-capture 402.</div><div>2 · Client → gateway: signed retry; facilitator confirms the hold before the handler.</div><div>3 · Merchant → facilitator: capture 300 and release 700 atomically.</div><div>4 · Gateway → client: paid JSON + PAYMENT-RESPONSE and payment ID.</div><div>5 · Later merchant refund: 100 moves from merchant wallet to client.</div></div>
<div class="sources">Demo: <a href="demo.md">runbook</a> · <a href="../../../examples/gateway/src/app.ts">gateway middleware</a> · <a href="../../../examples/client/src/payment-tools.ts">agent payment tools</a><br>The recorded local validator demo includes a later merchant-initiated refund; HTTP tests separately use simulated RPC.</div>

---

<!-- _class: paper -->

<div class="eyebrow">Appendix / Q&amp;A · Optional</div>

## How does this demo use x402?

<div class="grid two">
<div class="card"><h3>Does the agent need a wallet?</h3><p>Yes. The app signs with a local Solana keypair. The model calls a paid API tool; it never receives the key.</p></div>
<div class="card"><h3>Which network do we use?</h3><p>The recorded payment uses a local validator and test token. The program is on Devnet; a Devnet USDC payment is next to verify.</p></div>
<div class="card"><h3>What does the facilitator do?</h3><p>It verifies and submits payments. This demo runs a separate local facilitator that sponsors transactions.</p></div>
<div class="card"><h3>Can x402 handle fiat or cards?</h3><p>Not natively. Third-party gateways can add those rails; this demo does not.</p></div>
</div>

<div class="sources">Official answers: <a href="https://docs.x402.org/faq">x402 FAQ</a> · <a href="https://docs.x402.org/core-concepts/facilitator">Facilitator</a><br>Demo implementation: <a href="../../../examples/client/src/agent.ts">agent</a> · <a href="../../../examples/client/src/payment-tools.ts">paid API tools</a> · <a href="../../../examples/gateway/src/run-facilitator.ts">local facilitator</a><br>Further reading: <a href="https://x402.org/wp-content/uploads/sites/10/2026/06/x402-whitepaper.pdf">x402 whitepaper</a> · <a href="https://github.com/x402-foundation/x402/tree/main/specs">x402 specifications</a></div>
