import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CHURCH_TEST_SERVER === "1" ? ".next-test" : ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
