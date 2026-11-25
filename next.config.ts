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
  // 도메인 연결 전 Vercel 운영 주소로 들어오면 같은 경로의 towbchurch.com으로 보낸다(브랜치 미리보기 주소는 그대로).
  async redirects() {
    return ['dreaming-towb-church.vercel.app', 'dreaming-good-church.vercel.app'].map(host => ({ source: '/:path*', has: [{ type: 'host' as const, value: host }], destination: 'https://towbchurch.com/:path*', permanent: true }));
  },
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
