import { IconRocket } from "./icons";
import type { ConnectionMode } from "@/lib/types";

export function Banner({ mode }: { mode: ConnectionMode }) {
  const message =
    mode === "live"
      ? "The marketplace router is live. Registered Ollama endpoints can now receive routed requests."
      : mode === "offline"
        ? "The marketplace router is offline. Start the local services and retry the connection."
        : "Checking the marketplace router and registered Ollama endpoints.";

  return (
    <div className="banner" role="status">
      <IconRocket size={13} />
      <span className="truncate">{message}</span>
    </div>
  );
}
