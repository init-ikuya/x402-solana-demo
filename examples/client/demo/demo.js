const $ = id => document.getElementById(id);
const stepIds = ["tool", "quote", "sign", "paid"];
const eventBox = $("events");
const answerLines = [];
let ceiling;
let charge;
let completed = false;
let beforeSnapshot;
let paymentSeen = false;

function flash(element) {
  element.classList.remove("flash");
  void element.offsetWidth;
  element.classList.add("flash");
}

function setValue(id, value, highlight = $(id)) {
  const element = $(id);
  if (element.textContent === value) return;
  element.textContent = value;
  flash(highlight);
}

function atomicChange(now, before) {
  if (now === null || before === null) return "Change: unavailable";
  const delta = BigInt(now) - BigInt(before);
  return "Change: " + (delta > 0n ? "+" : "") + delta + " token units";
}

function sol(lamports) {
  const units = BigInt(lamports);
  return `${units / 1_000_000_000n}.${(units % 1_000_000_000n).toString().padStart(9, "0")} SOL`;
}

async function refreshAccounts() {
  $("account-status").textContent = "Reading confirmed Solana account state…";
  try {
    const response = await fetch("/snapshot", { cache: "no-store" });
    const snapshot = await response.json();
    if (!response.ok) throw new Error(snapshot.error || `RPC returned ${response.status}`);
    if (!snapshot.configured) {
      $("account-status").textContent = snapshot.reason;
      return;
    }
    const local = snapshot.environment === "local validator";
    setValue("asset-status", local ? "Local validator · test token" : "Devnet · USDC");
    $("asset-status").title = `Mint: ${snapshot.asset}`;
    if (!beforeSnapshot && !paymentSeen) beforeSnapshot = snapshot;
    $("account-status").textContent = `Confirmed ${local ? "local" : "Devnet"} RPC read · ${new Date(snapshot.observedAt).toLocaleTimeString()} · slots ${snapshot.payer.slot} / ${snapshot.merchant.slot}`;
    for (const role of ["payer", "merchant"]) {
      const wallet = snapshot[role];
      $(role + "-address").textContent = wallet.address;
      $(role + "-address").title = wallet.address;
      setValue(role + "-usdc", wallet.usdc ?? "No token account");
      $(role + "-sol").textContent = "SOL: " + sol(wallet.lamports);
      $(role + "-delta").textContent = beforeSnapshot
        ? atomicChange(wallet.usdc, beforeSnapshot[role].usdc) : "Change: baseline pending";
    }
    if (snapshot.payment) {
      $("account-payment-id").textContent = snapshot.payment.id;
      $("account-payment-id").title = snapshot.payment.id;
      for (const field of ["funded", "captured", "released", "refunded"]) {
        setValue(field, snapshot.payment[field]);
      }
      $("vault-usdc").textContent = snapshot.payment.vaultUsdc ?? "Closed";
      $("hold-status").textContent = `Hold ${snapshot.payment.holdClosed ? "closed" : "open"} · next operation ${snapshot.payment.nextOperation}`;
    }
  } catch (error) {
    $("account-status").textContent = "Account read failed: " + error.message;
  }
}

function step(index) {
  for (let i = 0; i < stepIds.length; i++) {
    const item = $("step-" + stepIds[i]);
    item.classList.toggle("done", i < index);
    item.classList.toggle("active", i === index);
  }
}

function status(message, error = false) {
  setValue("status", message);
  $("status").classList.toggle("error", error);
}

function showEvent(message, error = false) {
  const placeholder = eventBox.querySelector(".placeholder");
  if (placeholder) placeholder.remove();
  const item = document.createElement("div");
  item.className = error ? "event error" : "event";
  item.textContent = message;
  eventBox.append(item);
  eventBox.scrollTop = eventBox.scrollHeight;
}

function decodedAfter(line, marker) {
  const start = line.indexOf(marker);
  if (start < 0) return;
  try { return JSON.parse(line.slice(start + marker.length)); }
  catch { return; }
}

function handleOutput(line) {
  const request = line.match(/^\[HTTP\] → (\w+) (\S+) (.*)$/);
  if (request) {
    const signed = request[3].includes("PAYMENT-SIGNATURE");
    const id = signed ? "signed-request" : "initial-request";
    setValue(id, `${request[1]} ${request[2]}`, $(id).closest(".http-state"));
  }
  if (line.startsWith("[AGENT] Selected tool:")) {
    step(0);
    status("Agent selected the paid tool");
    showEvent(line);
    return;
  }
  if (line.includes("402 PAYMENT-REQUIRED")) {
    const quote = decodedAfter(line, "(decoded): ");
    if (quote && quote.scheme === "auth-capture" && /^\d+$/.test(quote.amount)) {
      ceiling = BigInt(quote.amount);
      setValue("ceiling", ceiling.toString());
      $("quote-detail").textContent = `Ceiling ${quote.amount} atomic units`;
    }
    setValue("initial-response", "HTTP 402 Payment Required", $("initial-response").closest(".http-state"));
    step(1);
    status("Gateway quoted an auth-capture hold");
    showEvent(line);
    return;
  }
  if (line.includes("PAYMENT-SIGNATURE: [redacted]")) {
    step(2);
    status("Payer-signed hold sent");
    showEvent(line);
    return;
  }
  if (line.includes("PAYMENT-RESPONSE")) {
    const payment = decodedAfter(line, "(decoded): ");
    setValue("paid-response", (line.match(/← (\d+) PAYMENT-RESPONSE/) || [])[1]
      ? `HTTP ${line.match(/← (\d+) PAYMENT-RESPONSE/)[1]}` : "Response received",
    $("paid-response").closest(".http-state"));
    if (payment?.success === true && /^\d+$/.test(payment.amount)) {
      paymentSeen = true;
      charge = BigInt(payment.amount);
      setValue("charge", charge.toString());
      if (ceiling !== undefined && charge <= ceiling) setValue("remainder", (ceiling - charge).toString());
      if (typeof payment.paymentId === "string") $("payment-id").textContent = "Payment PDA: " + payment.paymentId;
      $("paid-detail").textContent = `Captured ${payment.amount} · confirmed`;
      void refreshAccounts();
      step(3);
      status("Settlement response received");
    } else status("Payment response needs inspection", true);
    showEvent(line);
    return;
  }
  if (line.includes("JSON body preview:")) {
    const report = decodedAfter(line, "JSON body preview: ");
    if (report && typeof report.reportId === "string") {
      $("report-empty").hidden = true;
      $("report-content").hidden = false;
      $("report-id").textContent = report.reportId;
      $("report-headline").textContent = report.headline || report.title || "Paid report";
      flash($("report-content").closest(".report"));
    }
    showEvent(line);
    return;
  }
  if (line.startsWith("[HTTP]") || line.startsWith("API reports used:") ||
      line.startsWith("Completed paid requests:")) {
    showEvent(line);
    return;
  }
  if (line.trim()) {
    answerLines.push(line);
    $("answer").classList.remove("placeholder");
    setValue("answer", answerLines.join("\n").replace(/\*\*/g, "").replace(/ {2,}\n/g, "\n"),
      $("answer").closest(".answer"));
  }
}

const stream = new EventSource("/events");
stream.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.kind === "start") {
    $("run").disabled = true;
    status("Agent is running");
    showEvent("Agent run started");
  } else if (data.kind === "output") handleOutput(data.text);
  else if (data.kind === "done") {
    completed = true;
    $("run").disabled = true;
    if (data.code === 0) step(4);
    status(data.code === 0 ? "Demo completed" : "Demo failed; inspect the server terminal", data.code !== 0);
    showEvent(data.code === 0 ? "Run complete" : "Run failed; inspect the server terminal", data.code !== 0);
    stream.close();
    void refreshAccounts();
  }
};
stream.onerror = () => {
  if (!completed) status("Event stream disconnected", true);
};

$("run").addEventListener("click", async () => {
  $("run").disabled = true;
  status("Starting agent");
  await refreshAccounts();
  try {
    const response = await fetch("/run", { method: "POST" });
    if (!response.ok) throw new Error(await response.text());
  } catch (error) {
    $("run").disabled = false;
    status(error.message, true);
    showEvent(error.message, true);
  }
});

$("refresh").addEventListener("click", () => void refreshAccounts());
void refreshAccounts();
