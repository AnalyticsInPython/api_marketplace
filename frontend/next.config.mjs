/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fonts load at runtime via the <link> in app/layout.tsx, so we skip Next's
  // build-time font inlining. Keeps `next build` free of any network fetch.
  optimizeFonts: false,
};

export default nextConfig;
