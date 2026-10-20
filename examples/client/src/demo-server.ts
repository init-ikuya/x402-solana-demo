import { spawn } from "node:child_process";
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { readDemoSnapshot } from "./demo-snapshot.js";
import { loadKeypair } from "./keypair.js";

type DemoEvent = { id: number; kind: "start" | "output" | "done"; text?: string; code?: number };

const port = Number(process.env.DEMO_PORT ?? "4023");
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("DEMO_PORT must be a valid port");
const origin = `http://127.0.0.1:${port}`;
const assets = new Map([
  ["/", { url: new URL("../demo/index.html", import.meta.url), type: "text/html; charset=utf-8" }],
  ["/demo.css", { url: new URL("../demo/demo.css", import.meta.url), type: "text/css; charset=utf-8" }],
  ["/demo.js", { url: new URL("../demo/demo.js", import.meta.url), type: "text/javascript; charset=utf-8" }],
  ["/client.svg", { url: new URL("../demo/client.svg", import.meta.url), type: "image/svg+xml" }],
  ["/provider.svg", { url: new URL("../demo/provider.svg", import.meta.url), type: "image/svg+xml" }],
]);
const events: DemoEvent[] = [];
const listeners = new Set<ServerResponse>();
let started = false;
let latestPaymentId: string | undefined;

function publish(event: Omit<DemoEvent, "id">): void {
  const entry = { ...event, id: events.length + 1 };
  events.push(entry);
  const wire = `id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`;
  for (const response of listeners) response.write(wire);
}

const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'");
  const path = request.url?.split("?")[0];
  if (request.method === "GET" && path === "/snapshot") {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (!process.env.GATEWAY_PAY_TO ||
        !(process.env.PAYMENT_CLIENT_KEYPAIR_FILE || process.env.PAYMENT_CLIENT_SECRET_KEY)) {
      response.writeHead(200).end(JSON.stringify({ configured: false,
        reason: "Configure GATEWAY_PAY_TO and the payer key in examples/client/.env" }));
      return;
    }
    void loadKeypair(process.env.PAYMENT_CLIENT_KEYPAIR_FILE, process.env.PAYMENT_CLIENT_SECRET_KEY)
      .then(signer => readDemoSnapshot({
        payer: signer.address, merchant: process.env.GATEWAY_PAY_TO!,
        rpcUrl: process.env.PAYMENT_RPC_URL ?? "https://api.devnet.solana.com",
        paymentId: latestPaymentId,
      }))
      .then(snapshot => response.writeHead(200).end(JSON.stringify({ configured: true, ...snapshot })),
        error => response.writeHead(503).end(JSON.stringify({ error: String(error) })));
    return;
  }
  if (request.method === "GET" && path === "/events") {
    response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", Connection: "keep-alive" });
    const lastId = Number(request.headers["last-event-id"] ?? "0");
    for (const event of events) {
      if (event.id > (Number.isSafeInteger(lastId) ? lastId : 0)) {
        response.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    }
    listeners.add(response);
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15_000);
    request.on("close", () => {
      clearInterval(heartbeat);
      listeners.delete(response);
    });
    return;
  }
  if (request.method === "POST" && path === "/run") {
    if (request.headers.origin !== origin) {
      response.writeHead(403).end("Same-origin request required");
      return;
    }
    if (started) {
      response.writeHead(409).end("This demo server has already started one payment run");
      return;
    }
    if (!process.env.GATEWAY_PAY_TO ||
        !(process.env.PAYMENT_CLIENT_KEYPAIR_FILE || process.env.PAYMENT_CLIENT_SECRET_KEY)) {
      response.writeHead(400).end("Configure GATEWAY_PAY_TO and the payer key in examples/client/.env");
      return;
    }
    if ((process.env.AGENT_MODEL_PROVIDER ?? "lm-studio") === "lm-studio" && !process.env.LM_STUDIO_MODEL) {
      response.writeHead(400).end("Configure LM_STUDIO_MODEL with a loaded LM Studio model ID");
      return;
    }
    started = true;
    response.writeHead(202, { "Content-Type": "application/json" }).end('{"started":true}');
    publish({ kind: "start" });
    const child = spawn(process.execPath,
      ["--import", "tsx", fileURLToPath(new URL("./agent.ts", import.meta.url))],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AGENT_SCHEMES: "auth-capture",
          AGENT_MODEL_PROVIDER: process.env.AGENT_MODEL_PROVIDER ?? "lm-studio",
          AGENT_MAX_PAYMENTS: "1",
          AGENT_MAX_TOTAL_AMOUNT: "1000",
          PAYMENT_DEMO_TRACE: "1",
          AGENT_PROMPT: process.env.DEMO_AGENT_PROMPT ??
            "Call the auth-capture paid API once. Include the report ID and exact headline. State the amount charged in atomic token units only; do not invent a fiat conversion.",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    createInterface({ input: child.stdout }).on("line", line => {
      if (line.includes("PAYMENT-RESPONSE (decoded): ")) {
        try {
          const payment = JSON.parse(line.split("PAYMENT-RESPONSE (decoded): ")[1]) as
            { success?: boolean; paymentId?: string };
          if (payment.success === true && typeof payment.paymentId === "string") latestPaymentId = payment.paymentId;
        } catch { /* The browser trace still displays the unreadable response. */ }
      }
      publish({ kind: "output", text: line });
    });
    createInterface({ input: child.stderr }).on("line", line => {
      process.stderr.write(`${line}\n`);
    });
    child.on("error", error => {
      process.stderr.write(`Demo agent failed to start: ${error.message}\n`);
    });
    child.on("close", code => publish({ kind: "done", code: code ?? 1 }));
    return;
  }
  const asset = request.method === "GET" ? assets.get(path ?? "") : undefined;
  if (!asset) {
    response.writeHead(404).end("Not found");
    return;
  }
  void readFile(asset.url).then(body => {
    response.writeHead(200, { "Content-Type": asset.type }).end(body);
  }, () => response.writeHead(500).end("Demo asset unavailable"));
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Auth-capture demo: ${origin}\nOne paid run is allowed per server start.\n`);
});
