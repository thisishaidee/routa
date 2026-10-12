import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { acceptBrowserRoutine, callTool, coerceAgentFile, emptyAgentFile, type AgentFile } from "../src/lib/daymark/mcp/apply";

const PORT = Number(process.env.ROUTA_MCP_PORT || 8787);
const DATA_PATH = process.env.ROUTA_DATA || join(homedir(), ".routa", "agent.json");

const TOOLS = [
  {
    name: "routa_get_routine",
    description: "Read the Routa routine this agent can edit. Reminders are not phone Clock alarms.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "routa_today",
    description: "List today's planned sessions. This is the schedule, not what the person checked off.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "routa_add_session",
    description: "Add one session. Does not remove existing sessions. reminder true turns on an in-app Routa reminder, not a Clock alarm.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        time: { type: "string", description: "24-hour HH:MM" },
        tasks: { type: "array", items: { type: "string" } },
        repeat: { description: "daily, weekdays, weekends, or days. 0 is Monday." },
        reminder: { type: "boolean" },
      },
      required: ["title", "time"],
    },
  },
  {
    name: "routa_update_session",
    description: "Change one session found by id, or by title if the title is unique. Pass id to rename it.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        time: { type: "string" },
        repeat: {},
        reminder: { type: "boolean" },
        enabled: { type: "boolean" },
      },
    },
  },
  {
    name: "routa_set_reminder",
    description: "Turn a session reminder on or off. On means Routa notifies while it is open. It does not write to the phone Clock.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        enabled: { type: "boolean" },
      },
      required: ["enabled"],
    },
  },
  {
    name: "routa_remove_session",
    description: "Remove one session by id or unique title. Other sessions stay.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, title: { type: "string" } },
    },
  },
];

function load(): AgentFile {
  try {
    if (!existsSync(DATA_PATH)) return emptyAgentFile(process.env.ROUTA_MCP_TOKEN || "");
    const file = coerceAgentFile(JSON.parse(readFileSync(DATA_PATH, "utf8")));
    if (process.env.ROUTA_MCP_TOKEN) file.token = process.env.ROUTA_MCP_TOKEN;
    return file;
  } catch {
    return emptyAgentFile(process.env.ROUTA_MCP_TOKEN || "");
  }
}

function save(file: AgentFile) {
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(file, null, 2));
}

function expectedToken() {
  return process.env.ROUTA_MCP_TOKEN || load().token || "";
}

function authorized(req: IncomingMessage) {
  const expected = expectedToken();
  if (!expected) return true;
  const header = req.headers.authorization || "";
  const alt = req.headers["x-routa-token"];
  return header === `Bearer ${expected}` || alt === expected;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Routa-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Length": Buffer.byteLength(raw),
  });
  res.end(raw);
}

function rpc(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function handleRpc(message: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } }) {
  const method = message.method || "";
  if (method === "initialize") {
    return rpc(message.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "routa", version: "1.0.0" },
    });
  }
  if (method === "ping") return rpc(message.id, {});
  if (method === "tools/list") return rpc(message.id, { tools: TOOLS });
  if (method === "tools/call") {
    const name = message.params?.name || "";
    const args = message.params?.arguments || {};
    const outcome = callTool(load(), name, args);
    if (!outcome.isError) save(outcome.file);
    return rpc(message.id, {
      content: [{ type: "text", text: outcome.text }],
      isError: outcome.isError,
    });
  }
  return { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: `Unknown method ${method}` } };
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const http = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (!authorized(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/v1/snapshot") {
    sendJson(res, 200, load());
    return;
  }
  if (req.method === "POST" && url.pathname === "/v1/snapshot") {
    void readBody(req).then((raw) => {
      const body = raw ? (JSON.parse(raw) as { routine?: AgentFile["routine"]; remindersEnabled?: boolean }) : {};
      const next = acceptBrowserRoutine(load(), body.routine ?? null, body.remindersEnabled === true);
      save(next);
      sendJson(res, 200, next);
    }).catch(() => sendJson(res, 400, { error: "bad json" }));
    return;
  }
  if (req.method === "POST" && url.pathname === "/mcp") {
    void readBody(req).then((raw) => {
      const message = JSON.parse(raw) as { id?: unknown; method?: string };
      if (message.id == null) {
        sendJson(res, 202, { ok: true });
        return;
      }
      sendJson(res, 200, handleRpc(message));
    }).catch(() => sendJson(res, 400, { error: "bad json" }));
    return;
  }
  sendJson(res, 404, { error: "not found" });
});

http.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`Routa agent link listening on http://127.0.0.1:${PORT}\n`);
});
http.on("error", (error) => {
  process.stderr.write(`Routa agent link could not listen: ${error instanceof Error ? error.message : "error"}\n`);
});

let pending = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  pending = Buffer.concat([pending, Buffer.from(chunk)]);
  while (true) {
    const headerEnd = pending.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = pending.slice(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) return;
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (pending.length < start + length) return;
    const raw = pending.slice(start, start + length).toString("utf8");
    pending = pending.slice(start + length);
    let message: { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
    try {
      message = JSON.parse(raw);
    } catch {
      continue;
    }
    if (message.id == null) continue;
    const payload = Buffer.from(JSON.stringify(handleRpc(message)));
    process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
    process.stdout.write(payload);
  }
});
