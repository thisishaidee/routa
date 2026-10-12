import { useState } from "react";
import { isLocalAgentOrigin } from "@/lib/daymark/mcp/link";
import { useDaymark } from "@/lib/daymark/store";

export function AgentLinkCard() {
  const { agentLink, agentStatus, updateAgentLink } = useDaymark();
  const [origin, setOrigin] = useState(agentLink.origin);
  const [note, setNote] = useState("");
  const config = `{
  "mcpServers": {
    "routa": {
      "command": "npm",
      "args": ["run", "mcp"],
      "env": { "ROUTA_MCP_TOKEN": "${agentLink.token}" }
    }
  }
}`;

  const status =
    !agentLink.enabled
      ? "Listening is off."
      : agentStatus === "connected"
        ? "Connected. An agent on this computer can change the routine."
        : agentStatus === "unauthorized"
          ? "The token does not match the server."
          : "The agent server is not running yet.";

  return (
    <div className="rounded-3xl border border-line bg-paper p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-soft">Agents</p>
      <h2 className="mt-2 text-xl font-black">Connect an assistant</h2>
      <p className="mt-2 text-pretty text-sm leading-6 text-quiet">
        Claude, Cursor, or another agent on this computer can add a session or turn on a reminder through Routa’s MCP server. Routa applies it while this page is open. A cloud chat cannot reach this browser on its own, and nothing is written to the phone Clock.
      </p>
      <button
        type="button"
        onClick={() => updateAgentLink({ enabled: !agentLink.enabled })}
        className={`mt-4 h-12 rounded-xl px-4 text-sm font-bold ${agentLink.enabled ? "bg-forest text-paper" : "bg-canvas"}`}
      >
        {agentLink.enabled ? "Listening" : "Listen for agents"}
      </button>
      <p className="mt-3 text-sm text-olive">{status}</p>
      <label className="mt-4 block text-xs font-bold text-quiet">
        This computer
        <input
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
          onBlur={() => {
            if (!isLocalAgentOrigin(origin)) {
              setNote("Use http://127.0.0.1 and a port. Routa will not send your routine anywhere else.");
              setOrigin(agentLink.origin);
              return;
            }
            setNote("");
            updateAgentLink({ origin });
          }}
          className="mt-2 h-12 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink outline-none focus:border-lime"
        />
      </label>
      {note ? <p className="mt-2 text-sm text-danger">{note}</p> : null}
      <p className="mt-4 text-xs font-bold text-quiet">Token</p>
      <p className="mt-1 break-all text-sm">{agentLink.token || "Turn listening on to create a token."}</p>
      <p className="mt-4 text-xs font-bold text-quiet">Add this in the agent, from the Routa project folder</p>
      <textarea readOnly value={config} rows={8} className="mt-2 w-full rounded-xl border border-line bg-canvas p-3 text-xs text-ink" />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(config).then(
            () => setNote("Config copied."),
            () => setNote("Select the config and copy it."),
          );
        }}
        className="mt-3 h-11 rounded-xl bg-canvas px-3 text-xs font-bold"
      >
        Copy config
      </button>
    </div>
  );
}
