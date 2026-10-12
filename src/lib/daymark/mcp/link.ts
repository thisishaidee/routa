import { coerceAgentFile, type AgentFile } from "./apply";

export const AGENT_KEY = "routa:v2:agent";
export const DEFAULT_AGENT_ORIGIN = "http://127.0.0.1:8787";

export interface AgentLink {
  enabled: boolean;
  origin: string;
  token: string;
}

export function createAgentToken() {
  const core =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2);
  return `routa_${core}`;
}

export function emptyAgentLink(): AgentLink {
  return { enabled: false, origin: DEFAULT_AGENT_ORIGIN, token: "" };
}

export function isLocalAgentOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.port !== "";
  } catch {
    return false;
  }
}

export function loadAgentLink(): AgentLink {
  try {
    if (typeof localStorage === "undefined") return emptyAgentLink();
    const raw = localStorage.getItem(AGENT_KEY);
    if (!raw) return emptyAgentLink();
    const value = JSON.parse(raw) as Partial<AgentLink>;
    const origin = typeof value.origin === "string" && isLocalAgentOrigin(value.origin) ? value.origin : DEFAULT_AGENT_ORIGIN;
    return {
      enabled: value.enabled === true,
      origin,
      token: typeof value.token === "string" ? value.token : "",
    };
  } catch {
    return emptyAgentLink();
  }
}

export function saveAgentLink(link: AgentLink) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(AGENT_KEY, JSON.stringify(link));
  } catch {
    /* ignore */
  }
}

export type AgentPull = AgentFile | { error: "offline" | "unauthorized" | "bad" };

export async function pullAgent(origin: string, token: string): Promise<AgentPull> {
  if (!isLocalAgentOrigin(origin)) return { error: "bad" };
  try {
    const response = await fetch(`${origin.replace(/\/$/, "")}/v1/snapshot`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 401) return { error: "unauthorized" };
    if (!response.ok) return { error: "bad" };
    return coerceAgentFile(await response.json());
  } catch {
    return { error: "offline" };
  }
}

export async function pushAgent(
  origin: string,
  token: string,
  body: Pick<AgentFile, "routine" | "remindersEnabled">,
): Promise<AgentPull> {
  if (!isLocalAgentOrigin(origin)) return { error: "bad" };
  try {
    const response = await fetch(`${origin.replace(/\/$/, "")}/v1/snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (response.status === 401) return { error: "unauthorized" };
    if (!response.ok) return { error: "bad" };
    return coerceAgentFile(await response.json());
  } catch {
    return { error: "offline" };
  }
}
