---
marp: true
size: 16:9
title: Anchoring Payment Channels — Architecture Diagram
lang: en
style: |
  section {
    background: #f7f9f7;
    color: #16302c;
    font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif;
    padding: 28px 48px 22px;
    justify-content: flex-start;
    font-size: 18px;
  }
  h1, p { margin: 0; }
  h1 { font-size: 36px; line-height: 1.08; letter-spacing: -1.1px; }
  .sub { margin-top: 7px; color: #52736a; font-size: 18px; }
  .shared-label { margin-top: 15px; font-size: 13px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #52736a; }
  .shared { display: grid; grid-template-columns: 1fr 26px 1.42fr 26px 1.5fr 26px 1fr; gap: 6px; align-items: center; margin-top: 7px; }
  .shared .box { height: 70px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; padding: 9px 16px; background: #e9f0ed; border: 1.5px solid #b8cbc2; border-radius: 11px; }
  .box b { font-size: 18px; }
  .box span { font-size: 14px; color: #47655c; line-height: 1.18; margin-top: 2px; }
  .arrow { text-align: center; font-size: 27px; color: #09826c; font-weight: 700; }
  .routes-label { margin-top: 15px; font-size: 13px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #52736a; }
  .heads, .route { display: grid; grid-template-columns: 180px 238px 340px 1fr; gap: 12px; }
  .heads { margin: 6px 0 3px; color: #52736a; font-size: 14px; font-weight: 700; }
  .heads div { padding-left: 13px; }
  .route { margin-top: 7px; }
  .cell { position: relative; min-height: 74px; box-sizing: border-box; padding: 10px 12px; background: white; border: 1.5px solid #cfdbd5; border-radius: 10px; font-size: 14px; line-height: 1.2; }
  .cell:not(:last-child)::after { content: '→'; position: absolute; right: -17px; top: 27px; color: #09826c; font-size: 19px; font-weight: 700; z-index: 2; }
  .cell b { display: block; font-size: 17px; line-height: 1.12; margin-bottom: 4px; }
  .cell em { display: block; font-size: 12px; font-style: normal; color: #52736a; margin-top: 2px; }
  .focus .cell { background: #ebf8f2; border-color: #16876b; }
  .focus .cell:first-child { background: #086e5a; color: white; }
  .focus .cell:first-child em { color: #d0f2e5; }
  .focus .cell:not(:last-child)::after { color: #086e5a; }
  .note { margin-top: 9px; padding-top: 7px; border-top: 1px solid #c9d8cf; color: #52736a; font-size: 12px; line-height: 1.2; }
  .detail h1 { font-size: 38px; }
  .detail .sub { margin-top: 8px; font-size: 17px; }
  .phase-label { margin: 25px 0 8px; color: #52736a; font-size: 13px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; }
  .flow3 { display: grid; grid-template-columns: 1fr 28px 1fr 28px 1fr; gap: 9px; align-items: center; }
  .flowbox { min-height: 94px; box-sizing: border-box; padding: 14px 17px; border: 1.5px solid #b8cbc2; border-radius: 11px; background: #e9f0ed; font-size: 16px; line-height: 1.25; }
  .flowbox b { display: block; margin-bottom: 6px; font-size: 19px; }
  .flowbox strong { color: #086e5a; }
  .down { margin: 11px 0 3px; text-align: center; color: #09826c; font-size: 27px; font-weight: 700; line-height: 1; }
  .branches { display: grid; grid-template-columns: repeat(2, 1fr); gap: 17px; }
  .branches.three { grid-template-columns: repeat(3, 1fr); }
  .branch { min-height: 143px; box-sizing: border-box; padding: 15px 18px; border: 1.5px solid #b8cbc2; border-radius: 11px; background: white; font-size: 16px; line-height: 1.28; }
  .branch b { display: block; margin-bottom: 8px; font-size: 19px; }
  .branch.focus { background: #ebf8f2; border-color: #16876b; }
  .branch .path { display: block; margin-top: 8px; font-weight: 700; color: #086e5a; }
  .finalbar { margin-top: 17px; padding: 16px 19px; border-radius: 11px; background: #0b705b; color: white; font-size: 17px; line-height: 1.25; }
  .finalbar b { margin-right: 12px; font-size: 19px; }
  .detail .note { margin-top: 13px; font-size: 13px; }
  .ledger { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .ledger div { padding: 14px 17px; border: 1.5px solid #b8cbc2; border-radius: 11px; background: #e9f0ed; font-size: 15px; line-height: 1.25; }
  .ledger b { display: block; margin-bottom: 5px; font-size: 18px; }
  .checkflow { display: grid; grid-template-columns: 1fr 28px 1fr 28px 1fr; gap: 9px; align-items: stretch; }
  .check { min-height: 112px; box-sizing: border-box; padding: 13px 16px; border: 1.5px solid #16876b; border-radius: 11px; background: #ebf8f2; font-size: 15px; line-height: 1.24; }
  .check b { display: block; margin-bottom: 7px; font-size: 18px; }
  .checkflow .arrow { align-self: center; }
  .reject { margin-top: 10px; padding: 10px 16px; border: 1.5px solid #d7a9a2; border-radius: 9px; background: #fff1ee; color: #713a33; font-size: 15px; line-height: 1.22; }
  .matrix { width: 100%; margin-top: 9px; border-collapse: collapse; table-layout: fixed; font-size: 15px; line-height: 1.22; }
  .matrix th { padding: 9px 12px; text-align: left; background: #dcebe4; color: #205449; font-size: 14px; }
  .matrix td { padding: 10px 12px; border-bottom: 1px solid #c9d8cf; vertical-align: top; background: white; }
  .matrix tr:nth-child(even) td { background: #f1f6f3; }
  .matrix th:first-child, .matrix td:first-child { width: 16%; font-weight: 700; }
  .matrix th:nth-child(2), .matrix td:nth-child(2) { width: 37%; }
  .matrix th:nth-child(3), .matrix td:nth-child(3) { width: 47%; }
  .account-strip { margin-top: 17px; display: grid; grid-template-columns: 1fr 27px 1.25fr 27px 1fr; gap: 8px; align-items: center; }
  .account-strip .flowbox { min-height: 78px; padding: 10px 14px; font-size: 14px; }
  .account-strip .flowbox b { font-size: 17px; margin-bottom: 4px; }
  .compact .phase-label { margin-top: 17px; }
  .compact .matrix td { padding: 8px 12px; }
  .spec .phase-label { margin-top: 17px; }
  .spec .branch { min-height: 112px; padding: 12px 15px; font-size: 14px; }
  .spec .branch b { font-size: 17px; margin-bottom: 5px; }
  .spec .ledger { margin-top: 9px; }
  .spec .ledger div { padding: 11px 14px; font-size: 14px; }
  .spec .ledger b { font-size: 17px; }
  .spec .matrix { font-size: 14px; }
  .spec .matrix td { padding: 8px 10px; }
  .spec .note { font-size: 12px; }
  .comparison .matrix th:first-child, .comparison .matrix td:first-child { width: 19%; }
  .comparison .matrix th:nth-child(2), .comparison .matrix td:nth-child(2) { width: 35%; }
  .comparison .matrix th:nth-child(3), .comparison .matrix td:nth-child(3) { width: 46%; }
---

# Anchoring Payment Channels — architecture
<p class="sub">Planned x402 demo on Solana · Four schemes in scope · Two primary Anchor experiments</p>

<div class="shared-label">Shared request path</div>
<div class="shared">
  <div class="box"><b>AI model</b><span>Selects a paid tool</span></div><div class="arrow">→</div>
  <div class="box"><b>Agent + payment tool</b><span>App checks budget and signs; AI never sees private keys</span></div><div class="arrow">↔</div>
  <div class="box"><b>TypeScript gateway</b><span>x402 HTTP 402 / retry; pricing, request state, scheme routing</span></div><div class="arrow">↔</div>
  <div class="box"><b>Paid API</b><span>Returns the tool result</span></div>
</div>

<div class="routes-label">Selected scheme routes · one route per paid API call</div>
<div class="heads"><div>Scheme</div><div>Client authorization</div><div>Gateway / facilitator</div><div>Solana state and fund movement</div></div>

<div class="route">
  <div class="cell"><b>exact</b><em>Official SVM binding</em></div>
  <div class="cell">Signs a token transfer meeting the quoted amount.</div>
  <div class="cell">Facilitator verifies, sponsors, submits, and confirms the transfer.</div>
  <div class="cell">SPL Token or Token-2022 transfers at least the quoted amount to the merchant's ATA.</div>
</div>

<div class="route focus">
  <div class="cell"><b>batch-settlement</b><em>PRIMARY TARGET · #90 Closing recovery</em></div>
  <div class="cell">Funds a channel; the client signs cumulative vouchers for repeated requests (client mode).</div>
  <div class="cell">Merchant gateway stores vouchers. Facilitator normally settles; an independent merchant worker can submit during Closing if the facilitator is offline.</div>
  <div class="cell">Custom Anchor channel: Closing <code>settle</code> records the claim; later <code>seal</code> / <code>distribute</code> pays merchant and refunds unused funds.</div>
</div>

<div class="route">
  <div class="cell"><b>upto</b><em>Repository Anchor implementation</em></div>
  <div class="cell">Escrows a ceiling for one metered request.</div>
  <div class="cell">Gateway signs <code>settle</code> for the actual charge after the paid API runs.</div>
  <div class="cell">Repository Anchor program pays the actual charge and returns the remainder.</div>
</div>

<div class="route focus">
  <div class="cell"><b>auth-capture</b><em>PRIMARY TARGET · Solana binding</em></div>
  <div class="cell">Funds a hold; can reclaim remaining escrow after the deadline.</div>
  <div class="cell">Merchant authorizes capture, void, and refund; facilitator relays and sponsors.</div>
  <div class="cell">Custom Anchor payment PDA + vault: capture pays merchant, void returns hold; later refunds use merchant funds.</div>
</div>

<p class="note">Design proposal — exact and the repository-backed upto flow are locally tested through simulated RPC. The upto program is separately tested with LiteSVM; live devnet settlement remains unverified. The repository's upto Solana payload is not interoperable with the official fixed-program SVM upto binding. The #90 channel and auth-capture designs remain planned Anchor experiments. Auth-capture starts with escrow; direct charge is a later milestone.</p>

---

<!-- _class: detail spec comparison -->

# Four schemes — who authorizes the charge?
<p class="sub">Three schemes can use escrow as a ceiling; each has different rules for the actual charge. Exact has no escrow.</p>

<div class="phase-label">Compare the payment authority and the money path</div>
<table class="matrix"><thead><tr><th>Scheme / use</th><th>Who fixes the actual charge?</th><th>When tokens move; how unused or paid funds return</th></tr></thead><tbody>
  <tr><td><b>exact</b><br>One known charge</td><td>Client signs a transfer meeting the quoted amount.</td><td>One confirmed transfer to merchant. No escrow or built-in refund in this scheme.</td></tr>
  <tr><td><b>batch-settlement</b><br>Many requests / channel</td><td><b>Client mode in this demo:</b> client-controlled <code>payerAuthorizer</code> signs each cumulative total <code>V ≤ deposit</code>.</td><td>Deposit enters escrow once; voucher acceptance moves no tokens. <code>settle</code> records the claim; <code>distribute</code> pays it and returns unused funds at final close.</td></tr>
  <tr><td><b>upto</b><br>One metered request</td><td>Client escrows ceiling <code>D</code>; gateway merchant signs <code>settle</code> for actual <code>A ≤ D</code>.</td><td>Final settlement pays <code>A</code> to merchant and returns <code>D − A</code> to client. No later scheme refund of already paid <code>A</code>.</td></tr>
  <tr><td><b>auth-capture</b><br>One hold, possible captures</td><td>Client escrows maximum <code>D</code>; merchant signs each capture, bounded by the remaining hold.</td><td>Capture pays merchant; void/release/reclaim returns unused hold. A later refund of captured funds needs merchant consent and liquidity.</td></tr>
</tbody></table>

<div class="finalbar"><b>Example · first API call costs 0.3 of a 1.0 deposit</b>Batch keeps the unused 0.7 in the channel for later calls; upto closes and returns 0.7; auth-capture captures 0.3 and explicitly voids the remaining 0.7.</div>
<p class="note">Batch uses client mode here; the official SVM binding also offers server mode, where a trusted operator signs cumulative vouchers. In this repository's upto binding, the merchant signs <code>settle</code>. Auth-capture's Solana escrow binding is proposed, and direct <code>charge</code> is later work. Sources: <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement_svm.md">batch SVM</a>, <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/upto/scheme_upto_svm.md">upto SVM comparison</a>, <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md">auth-capture</a>.</p>

---

<!-- _class: detail -->

# Issue #90 — why recovery is needed
<p class="sub">A merchant can hold a valid voucher for work already served but still depend on the facilitator to record it.</p>

<div class="phase-label">Current behavior in the canonical payment-channels program</div>
<div class="flow3">
  <div class="flowbox"><b>1 · Client closes</b>The client calls <code>request_close</code>; the channel changes from <strong>Open</strong> to <strong>Closing</strong>.</div><div class="arrow">→</div>
  <div class="flowbox"><b>2 · Direct settle fails</b>Current permissionless <code>settle</code> accepts <strong>Open only</strong>, even during the Closing grace period.</div><div class="arrow">→</div>
  <div class="flowbox"><b>3 · Facilitator needed</b>The remaining <code>settle_and_seal</code> route requires the channel payee's signature; for this x402 batch setup, the payee is the facilitator.</div>
</div>
<div class="reject"><b>Failure scenario:</b> If the facilitator is offline, the merchant cannot independently record its latest client-signed voucher during Closing. Sealing freezes the recorded amount.</div>

<div class="phase-label">Issue #90 proposal: let the voucher holder submit directly before the deadline</div>
<div class="checkflow">
  <div class="check"><b>Merchant worker</b>Loads the saved voucher; uses independent RPC and its own SOL fee payer to submit Ed25519 verification + <code>settle</code>.</div><div class="arrow">→</div>
  <div class="check"><b>Program validates</b>Channel is still <code>Closing</code>, time is before the grace deadline, and the voucher signature, channel binding, and amount are valid.</div><div class="arrow">→</div>
  <div class="check"><b>Record, then pay later</b>Advance only the <code>settled</code> watermark; remain <code>Closing</code>. No token transfer yet.</div>
</div>

<div class="finalbar"><b>After the deadline</b>Permissionless <code>seal</code> → <code>distribute</code>. Escrow pays the recorded claim to the merchant and refunds unused funds to the client.</div>
<p class="note">Proposed independent Anchor experiment. At the reviewed upstream baseline, the #90 change is absent from the canonical program's main branch; the payee-signed cooperative route still exists. Recheck upstream before presenting. Page 3 shows the checks and account changes.</p>

---

<!-- _class: detail compact -->

# Issue #90 — checks and account effects
<p class="sub">Proposed direct <code>settle</code> in Closing · Client-signed voucher · One recipient, no prior distribution</p>

<div class="phase-label">Program decision at transaction execution</div>
<div class="checkflow">
  <div class="check"><b>1 · State and clock?</b>Channel is <code>Closing</code> and <code>now &lt; closure_started_at + grace_period</code>. Deadline is checked on chain.</div><div class="arrow">→</div>
  <div class="check"><b>2 · Voucher valid?</b>Signer and channel match; batch voucher <code>expiresAt = 0</code> (no voucher expiry); <strong>before:</strong> <code>settled &lt; voucher_total ≤ deposit</code>.</div><div class="arrow">→</div>
  <div class="check"><b>3 · Record claim</b><strong>After:</strong> <code>Channel.settled = voucher_total</code>. Keep status <code>Closing</code> and original deadline. <strong>No token transfer.</strong></div>
</div>
<div class="reject"><b>NO at either check → reject.</b> No channel or token-account changes. Reload state before retrying after a timeout or race with sealing.</div>

<div class="phase-label">Which account changes at each step?</div>
<table class="matrix"><thead><tr><th>Operation</th><th>Channel PDA / off-chain state</th><th>Token accounts</th></tr></thead><tbody>
  <tr><td>Open</td><td>Create channel: <code>Open</code>, <code>deposit = D</code>, <code>settled = 0</code>; client is voucher signer, facilitator is payee.</td><td>Client token account → escrow: <code>D</code>.</td></tr>
  <tr><td>Paid API calls</td><td>Client sends a signed voucher; merchant gateway stores latest <code>V</code>. Channel stays <code>Open</code>.</td><td>No on-chain transfer per call.</td></tr>
  <tr><td>Request close</td><td><code>Open → Closing</code>; record <code>closure_started_at</code>.</td><td>No token transfer.</td></tr>
  <tr><td>Direct settle</td><td>Before deadline, advance only <code>settled → V</code>; remain <code>Closing</code>.</td><td>No token transfer.</td></tr>
  <tr><td>Seal / distribute</td><td>After deadline: <code>Closing → Sealed → Distributed</code>.</td><td>Escrow → merchant: <code>V</code>; escrow → client refund account: <code>D − V</code>.</td></tr>
</tbody></table>
<p class="note">Amounts are token base units. The payout example assumes a 100% merchant share, valid destination token accounts, and no transfer fees. Distribution is a separate on-chain operation; a stored voucher or settled watermark alone is not merchant payment. Account fields are logical design values, not finalized serialization.</p>

---

<!-- _class: detail spec -->

# Issue #90 — proposed accounts and instructions
<p class="sub">Single merchant recipient · Independent Anchor experiment · Canonical lifecycle used as the comparison</p>

<div class="phase-label">What state exists?</div>
<div class="branches three">
  <div class="branch"><b>Channel PDA</b>Payer, payee = facilitator, client voucher signer, merchant, mint, deposit, settled, payout watermark, status, close time, grace period, nonce.</div>
  <div class="branch"><b>Escrow + token accounts</b>Channel PDA controls escrow. Fixed merchant and payer token accounts receive the claim and unused deposit at final distribution.</div>
  <div class="branch"><b>Merchant gateway store</b>Latest accepted voucher, request ID, channel ID, and transaction status are durable off-chain records. Voucher is not a PDA.</div>
</div>

<div class="phase-label">Which instruction does what?</div>
<table class="matrix"><thead><tr><th>Step</th><th>Signer / transaction</th><th>Channel and token effect</th></tr></thead><tbody>
  <tr><td>Open</td><td>Payer signs <code>open</code>; facilitator may sponsor fees.</td><td>Create channel and escrow; deposit <code>D</code>. Record client voucher signer and facilitator payee.</td></tr>
  <tr><td>Close request</td><td>Payer signs <code>request_close</code>.</td><td><code>Open → Closing</code>; write close time. Escrow unchanged.</td></tr>
  <tr><td>#90 fallback</td><td>Merchant fee payer sends <code>[Ed25519 verify, settle]</code> in one transaction.</td><td>Check voucher and grace deadline; advance <code>settled → V</code>. Stay <code>Closing</code>; no token transfer.</td></tr>
  <tr><td>Finalize</td><td>After deadline, anyone pays fees for <code>seal</code>, then <code>distribute</code>.</td><td><code>Closing → Sealed → Distributed</code>; escrow pays merchant <code>V</code> and payer <code>D − V</code>.</td></tr>
</tbody></table>
<p class="note">For each client-initiated paid API call, the merchant accepts a client-signed voucher off-chain before service. Proposed fields and PDA layout are logical, not the canonical program's byte layout. The fallback requires a valid voucher, not a facilitator signature. Source: <a href="https://github.com/solana-foundation/payment-channels/issues/90">Solana Foundation Issue #90</a>.</p>

---

<!-- _class: detail -->

# Solana auth-capture — escrow lifecycle
<p class="sub">Primary proposed binding · One payment PDA, one hold vault, explicit payer and merchant authorities</p>

<div class="phase-label">Authorize first; perform the paid task only after hold confirmation</div>
<div class="flow3">
  <div class="flowbox"><b>Client / payment tool</b>Checks the x402 ceiling and budget; signs a one-time <code>authorize</code> funding transaction.</div><div class="arrow">→</div>
  <div class="flowbox"><b>Anchor payment PDA + vault</b>Records payer, merchant, mint, deadlines, nonce, and amount; vault holds the maximum.</div><div class="arrow">→</div>
  <div class="flowbox"><b>Merchant gateway</b>Executes the task, records its outcome, and chooses a permitted lifecycle operation.</div>
</div>

<div class="down">↓</div>
<div class="phase-label">Finalize the held balance</div>
<div class="branches three">
  <div class="branch focus"><b>Task succeeds</b>Merchant signs <code>capture_and_void</code>. Vault → merchant for the actual charge; vault → client for the remainder.<span class="path">Example: hold 1.0 → capture 0.3 + release 0.7</span></div>
  <div class="branch"><b>Task fails</b>Merchant signs <code>void</code>. Vault → client for the entire remaining hold.<span class="path">No capture; no merchant payout</span></div>
  <div class="branch"><b>Service unavailable</b>After the capture deadline, client submits <code>reclaim</code> directly with its own fee payer.<span class="path">Vault → client for remaining hold only</span></div>
</div>

<div class="ledger">
  <div><b>Later refund</b>Merchant signs <code>refund</code>: merchant token account → client token account. Refund needs merchant liquidity and consent; it does not draw from the hold vault.</div>
  <div><b>Program checks</b>Unique payment and operation IDs, fixed destinations, signer authority, deadlines, and <code>captured + released ≤ funded</code>; <code>refunded ≤ captured</code>.</div>
</div>
<p class="note">Proposed experimental Solana binding; no official SVM auth-capture compatibility is claimed. Escrow is the first milestone; direct charge under the authorization flow is separate future work.</p>

---

<!-- _class: detail compact -->

# Auth-capture — checks and account effects
<p class="sub">Proposed escrow binding · Example uses one legacy SPL test mint and zero protocol fees</p>

<div class="account-strip">
  <div class="flowbox"><b>Client token account</b>Funds the maximum; receives release, reclaim, or refund.</div><div class="arrow">↔</div>
  <div class="flowbox"><b>Payment PDA + hold vault</b>Immutable parties, mint, destinations, nonce, deadlines; counters and operation sequence.</div><div class="arrow">↔</div>
  <div class="flowbox"><b>Merchant token account</b>Receives capture; supplies later refund liquidity.</div>
</div>

<div class="phase-label">Authorization and lifecycle gates</div>
<div class="checkflow">
  <div class="check"><b>Authorize?</b>Payer signature, unique payment ID, fixed mint/destinations, supported token accounts, and <code>now &lt; capture_deadline ≤ refund_deadline</code>.</div><div class="arrow">→</div>
  <div class="check"><b>Finalize hold?</b>Merchant signs capture/void. Capture ≤ remaining hold and requires <code>now &lt; capture_deadline</code>; void may release later. Payer reclaims from the deadline.</div><div class="arrow">→</div>
  <div class="check"><b>Refund later?</b>Merchant signs and funds refund before <code>refund_deadline</code>; amount ≤ <code>captured − refunded</code>; expected sequence required.</div>
</div>
<div class="reject"><b>Invalid signer, stale sequence, wrong account, deadline, or excess amount → reject.</b> Counters and token transfers succeed or fail together; no partial mutation.</div>

<div class="phase-label">Example: successful task, then a separate merchant-funded refund</div>
<table class="matrix"><thead><tr><th>Operation</th><th>Payment PDA counters</th><th>Token movement</th></tr></thead><tbody>
  <tr><td>Authorize 1.0</td><td><code>funded=1.0</code>, <code>captured=0</code>, <code>released=0</code>, <code>refunded=0</code>.</td><td>Client → hold vault: <code>1.0</code>.</td></tr>
  <tr><td>Capture + void 0.3</td><td><code>captured=0.3</code>, <code>released=0.7</code>; hold closes, payment record remains.</td><td>Vault → merchant: <code>0.3</code>; vault → client: <code>0.7</code>.</td></tr>
  <tr><td>Refund 0.1</td><td><code>refunded=0.1</code>; lifetime captured stays <code>0.3</code>.</td><td>Merchant → client: <code>0.1</code>. Final merchant net: <code>0.2</code>.</td></tr>
</tbody></table>
<p class="note">Invariants: <code>remaining_hold = funded − captured − released</code>, <code>captured + released ≤ funded</code>, <code>refunded ≤ captured</code>. Refund transfers merchant → client; the payment PDA checks its limits.</p>

---

<!-- _class: detail spec -->

# Auth-capture — proposed Solana wire contract
<p class="sub">x402 v2 envelope · Experimental escrow binding · Merchant-signed lifecycle transactions</p>

<div class="phase-label">Persistent payment and vault accounts</div>
<div class="ledger">
  <div><b>Payment PDA</b>Derived from program ID + versioned seed + payer + nonce. Stores payer, merchant, mint, token program, fixed destinations, funded/captured/released/refunded, next sequence, deadlines, and hold status.</div>
  <div><b>Hold vault + token accounts</b>PDA controls held tokens. Payer funds vault; vault pays merchant or releases to payer. Later <code>refund</code> transfers merchant → payer and updates the persistent payment record.</div>
</div>

<div class="phase-label">Proposed HTTP fields → program instructions</div>
<table class="matrix"><thead><tr><th>Boundary</th><th>Proposed binding fields / signature</th><th>Program action and acceptance gate</th></tr></thead><tbody>
  <tr><td>402</td><td><code>PAYMENT-REQUIRED</code>: <code>auth-capture</code>, Solana network, mint, ceiling, merchant, <code>paymentFlow=escrow</code>, deadlines, binding + program ID.</td><td>Agent checks terms and budget before signing.</td></tr>
  <tr><td>Retry</td><td><code>PAYMENT-SIGNATURE</code>: x402 <code>accepted</code> + payer, nonce, payment PDA, payer-signed <code>authorize</code> transaction.</td><td>Facilitator checks the signed terms, sponsors <code>authorize</code>, confirms hold, then merchant serves.</td></tr>
  <tr><td>Finalize</td><td>Later <code>/settle</code>: <code>payload.type=capture</code> + amount + sequence + merchant-signed transaction; <code>releaseRemainder=true</code> selects atomic <code>capture_and_void</code>.</td><td>Verify merchant consent, expected sequence, deadline, and remaining hold; transfer actual charge and release rest.</td></tr>
  <tr><td>Return</td><td><code>payload.type=void|refund</code> with merchant signature; payer <code>reclaim</code> goes directly to Solana after deadline.</td><td>Void/reclaim release hold; refund spends merchant funds, capped by captured minus refunded.</td></tr>
</tbody></table>
<p class="note">Proposed payload names and encoding; not an official SVM binding. The facilitator rejects wrong program/accounts and extra transfers before sponsoring. Authorization-flow <code>charge</code> is a later milestone. Basis: <a href="https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture.md">generic auth-capture scheme</a>.</p>
