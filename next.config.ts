import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: { "/api/bulletins/pdf": ["./assets/fonts/*"], "/api/bulletins/word-fonts": ["./assets/fonts/word/*", "./node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm"] },
  // subset-font reads harfbuzz's wasm from node_modules at run time, so it must stay unbundled.
  serverExternalPackages: ["subset-font", "harfbuzzjs", "fontverter"],
  distDir: process.env.CHURCH_BUILD_CHECK === "1" ? ".next-build-check" : process.env.CHURCH_TEST_SERVER === "1" ? ".next-test" : ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() { return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] }]; },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
