import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local LLM Marketplace — Console",
  description:
    "Live console for a local-network LLM marketplace: Ollama endpoints, routing, and request lifecycle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* UI sans (Inter) + data mono (JetBrains Mono). Loaded here so the app
            runs without a build-time font fetch; falls back to system stacks. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;550;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
