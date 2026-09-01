function UserInstruction({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative pl-10">
      <span
        className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-[8px] border border-line-strong bg-panel-3 font-mono text-[11px] font-semibold text-ink"
        aria-hidden="true"
      >
        {number}
      </span>
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      <div className="mt-1 text-[12px] leading-relaxed text-muted">{children}</div>
    </li>
  );
}

export function UserSetupGuide({ onlineSupplierCount }: { onlineSupplierCount: number }) {
  const marketplaceReady = onlineSupplierCount > 0;

  return (
    <section className="panel overflow-hidden" aria-labelledby="user-setup-title">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="eyebrow">User instructions</div>
          <h2 id="user-setup-title" className="mt-2 text-[17px] font-semibold text-ink">
            Launch the client and submit a request
          </h2>
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
            Use this dashboard immediately with no download, or connect through OpenCode for a full coding workflow.
          </p>
        </div>
        <span className={`badge shrink-0 ${marketplaceReady ? "badge-online" : "badge-busy"}`}>
          <span className="dot" />
          {marketplaceReady
            ? `${onlineSupplierCount} endpoint${onlineSupplierCount === 1 ? "" : "s"} ready`
            : "Waiting for endpoint"}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">Use the browser Playground</h3>
              <p className="mt-1 text-[12px] text-muted">Nothing to install. Submit directly from this page.</p>
            </div>
            <a className="btn btn-primary shrink-0" href="#prompt-submission">
              Go to prompt box
            </a>
          </div>

          <ol className="mt-5 grid gap-5 sm:grid-cols-2">
            <UserInstruction number={1} title="Confirm the marketplace is ready">
              Look for the Live badge at the top of the page and at least one ready endpoint in this panel. If no endpoint is ready, ask the operator or a supplier to connect one.
            </UserInstruction>
            <UserInstruction number={2} title="Write your request">
              Enter a clear prompt in the prompt box below, or select an example to try the system quickly.
            </UserInstruction>
            <UserInstruction number={3} title="Submit the prompt">
              Select Run prompt. You can also press Command + Enter on macOS or Ctrl + Enter on Windows and Linux.
            </UserInstruction>
            <UserInstruction number={4} title="Review the result">
              Read the response and use the routing diagram and live events to see which supplier handled the request.
            </UserInstruction>
          </ol>
        </div>

        <aside className="border-t border-line bg-panel-2 px-5 py-5 sm:px-6 lg:border-l lg:border-t-0">
          <h3 className="text-[14px] font-semibold text-ink">Use OpenCode instead</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Download OpenCode only if it is not already installed. Launch it, open this project folder, and choose Local Marketplace if the model is not selected automatically.
          </p>
          <a
            className="btn btn-ghost mt-4"
            href="https://opencode.ai/download"
            target="_blank"
            rel="noreferrer"
          >
            Download OpenCode
          </a>

          <div className="mt-5 text-[11.5px] font-medium text-ink">Connecting from another computer</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-dim">
            In that project&apos;s opencode.json, replace 127.0.0.1 with the router computer&apos;s Wi-Fi IP, then reopen the project.
          </p>
          <pre className="scroll-thin mt-2 overflow-x-auto rounded-[8px] border border-line bg-bg px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted">
            {`"baseURL": "http://<router-wifi-ip>:8000/v1"`}
          </pre>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            Once Local Marketplace is active, type your prompt in OpenCode and submit it normally. Responses still appear in this dashboard&apos;s event log.
          </p>
        </aside>
      </div>
    </section>
  );
}
