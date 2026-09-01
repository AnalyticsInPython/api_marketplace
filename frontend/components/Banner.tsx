import { IconRocket } from "./icons";
import type { ConnectionMode } from "@/lib/types";

export function Banner({ mode }: { mode: ConnectionMode }) {
  const message =
    mode === "live"
      ? "Qwen2.5-Coder is available across the local network. OpenCode requests route through the marketplace API."
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
