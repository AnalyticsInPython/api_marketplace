function Instruction({
  number,
  title,
  children,
  action,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <li className="relative grid gap-3 pl-11 sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] sm:gap-8 sm:pl-12">
      <span
        className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-[8px] border border-line-strong bg-panel-3 font-mono text-[11px] font-semibold text-ink"
        aria-hidden="true"
      >
        {number}
      </span>
      <div>
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{children}</div>
      </div>
      <div className="min-w-0 self-start">{action}</div>
    </li>
  );
}

export function SupplierSetupGuide() {
  return (
    <section className="panel overflow-hidden" aria-labelledby="supplier-setup-title">
      <div className="border-b border-line px-5 py-5 sm:px-6">
        <div className="eyebrow">New supplier setup</div>
        <h2 id="supplier-setup-title" className="mt-2 text-[17px] font-semibold text-ink">
          Prepare, launch, and submit a supplier Mac
        </h2>
        <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
          The supplier Mac only needs Ollama and the marketplace setup helper. Complete these actions on the Mac you want to add, while it is connected to the same trusted Wi-Fi as the router.
        </p>
      </div>

      <ol className="grid gap-6 px-5 py-6 sm:px-6">
        <Instruction
          number={1}
          title="Install and open Ollama"
          action={
            <a
              className="btn btn-ghost w-full sm:w-auto"
              href="https://ollama.com/download/mac"
              target="_blank"
              rel="noreferrer"
            >
              Download Ollama
            </a>
          }
        >
          <p>
            If Ollama is not installed, download the macOS app, move it to Applications, and open it once. If it is already installed, launch Ollama from Applications and leave it running.
          </p>
        </Instruction>

        <Instruction
          number={2}
          title="Download and run the setup helper"
          action={
            <div>
              <a className="btn btn-primary w-full sm:w-auto" href="/configure-ollama-macos.sh" download>
                Download setup helper
              </a>
              <div className="mt-3 text-[11.5px] font-medium text-ink">Run both lines in Terminal</div>
              <pre className="scroll-thin mt-2 overflow-x-auto rounded-[8px] border border-line bg-bg px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted">{`chmod +x ~/Downloads/configure-ollama-macos.sh
~/Downloads/configure-ollama-macos.sh`}</pre>
              <p className="mt-2 text-[11px] leading-relaxed text-dim">
                If your browser saved the file elsewhere, replace ~/Downloads with that folder.
              </p>
            </div>
          }
        >
          <p>
            Download the helper to the default Downloads folder. Open Terminal, paste the two commands shown here, and press Return after each one.
          </p>
          <p className="mt-2 text-[11.5px] text-dim">
            The helper downloads the Qwen model if needed, makes Ollama reachable on your local network, restarts Ollama, and prints the connection URL.
          </p>
        </Instruction>

        <Instruction
          number={3}
          title="Approve access and copy the connection URL"
          action={
            <div className="rounded-[10px] border border-line bg-bg px-3 py-3 font-mono text-[11px] leading-relaxed text-muted">
              <div className="text-online">Supplier Mac is ready.</div>
              <div className="mt-1">Endpoint URL: http://192.168.1.24:11434</div>
              <div>Model: qwen2.5-coder:1.5b</div>
            </div>
          }
        >
          <p>
            If macOS asks whether Ollama may accept incoming connections, choose Allow. Wait until Terminal says “Supplier Mac is ready,” then copy the endpoint URL it prints.
          </p>
          <p className="mt-2 text-[11.5px] text-dim">
            Keep Ollama open. The URL should resemble http://192.168.1.24:11434. Never expose this Ollama URL to the public internet.
          </p>
        </Instruction>

        <Instruction
          number={4}
          title="Verify and submit the endpoint"
          action={
            <a className="btn btn-ghost w-full sm:w-auto" href="#supplier-registration-form">
              Go to submission form
            </a>
          }
        >
          <p>
            In the form below, add a display name and paste the URL from Terminal. Leave the model as qwen2.5-coder:1.5b unless you installed another exact tag. Run network checks, resolve any reported issue, then select Submit endpoint.
          </p>
          <p className="mt-2 text-[11.5px] text-dim">
            After the endpoint appears online, use Send routed test to confirm the complete route from this dashboard through Ollama and back.
          </p>
        </Instruction>
      </ol>
    </section>
  );
}
