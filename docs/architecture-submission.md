---
marp: true
size: 16:9
title: Auth-Capture on Solana — Architecture
lang: en
style: |
  section { background: #f7f9f7; color: #16302c; font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif; padding: 42px 54px; font-size: 22px; }
  h1 { font-size: 40px; margin: 0 0 12px; }
  h2 { font-size: 28px; margin: 0 0 12px; }
  p { margin: 8px 0; }
  .sub { color: #52736a; font-size: 18px; }
  .row { display: grid; grid-template-columns: 1fr 30px 1fr 30px 1fr; align-items: stretch; gap: 10px; margin-top: 34px; }
  .box { border: 2px solid #bad0c5; border-radius: 14px; background: #eaf4ef; padding: 22px; font-size: 19px; }
  .box b { display: block; font-size: 25px; margin-bottom: 9px; }
  .arrow { align-self: center; font-size: 35px; text-align: center; color: #078165; }
  .chain { margin-top: 35px; border-radius: 14px; background: #0d7059; color: white; padding: 18px 23px; font-size: 20px; }
  .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 32px; }
  .step { border: 2px solid #b6cfc2; border-radius: 13px; background: white; padding: 18px; min-height: 145px; font-size: 17px; }
  .step b { display: block; font-size: 25px; color: #086e5a; margin-bottom: 9px; }
  .note { margin-top: 24px; font-size: 17px; color: #52736a; }
  .money { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 28px; }
  .money div { border-radius: 14px; background: #e3f0e8; padding: 22px; }
  .money b { display: block; font-size: 34px; color: #086e5a; }
---

# Auth-capture on Solana — architecture
<p class="sub">Experimental escrow-only x402 binding · Local Anchor implementation · Demo Day focus</p>

<div class="row">
  <div class="box"><b>AI agent + payment tool</b>Model selects the API tool. Application checks quote and budget; payer signs a bounded hold.</div>
  <div class="arrow">↔</div>
  <div class="box"><b>Gateway + paid API</b>Returns HTTP 402 terms. Waits for the funded hold, serves the fictional report, then merchant signs the actual capture.</div>
  <div class="arrow">↔</div>
  <div class="box"><b>Local facilitator</b>Validates exact signed transactions, sponsors SOL fees, submits, and confirms the in-request hold and capture.</div>
</div>

<div class="chain"><b>Solana / this repository's Anchor program</b> Payment PDA + hold vault enforce payer and merchant authority, deadlines, operation sequence, and accounting. Later refund and payer reclaim use direct signed CLI transactions.</div>

<p class="note">Scope: classic SPL Token, associated token accounts, one merchant, zero protocol fees. The Foundation payment-channels program and Issue #90 are separate from this binding.</p>

---

# One paid request and later recovery
<p class="sub">Payer-authorized hold before service; merchant-authorized capture after service</p>

<div class="flow">
  <div class="step"><b>1 · Quote</b>Gateway advertises a 1000-unit ceiling, mint, merchant, binding ID, and absolute deadlines.</div>
  <div class="step"><b>2 · Hold</b>Payer signs `authorize_hold`. Facilitator confirms the deposit before the handler runs.</div>
  <div class="step"><b>3 · Work</b>Gateway serves the fictional paid report only after authorization succeeds.</div>
  <div class="step"><b>4 · Finalize</b>Merchant signs `capture_and_void_hold(300)`; program pays 300 and returns 700 atomically.</div>
</div>

<div class="money">
  <div><b>700</b>Unused hold returns from vault to payer.</div>
  <div><b>100</b>Optional later refund comes from merchant liquidity.</div>
  <div><b>Deadline</b>Payer can reclaim only the remaining hold after capture expires.</div>
</div>

<p class="note">Evidence: LiteSVM program tests and HTTP integration tests with simulated RPC. Live Devnet balances and the generic direct-charge authorization flow remain unverified.</p>
