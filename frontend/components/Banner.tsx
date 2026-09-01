import { IconRocket } from "./icons";

export function Banner() {
  return (
    <div className="banner" role="status">
      <IconRocket size={13} />
      <span className="truncate">
        Qwen2.5-Coder is live across the local network — point OpenCode at the base
        URL to start routing prompts.
      </span>
    </div>
  );
}
