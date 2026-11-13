import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "꿈꾸는좋은교회", short_name: "좋은교회", lang: "ko-KR",
    description: "꿈꾸는좋은교회 주보와 소식", start_url: "/", scope: "/", display: "standalone",
    background_color: "#faf9f5", theme_color: "#253d35",
    icons: [
      { src: "/icons/church-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/church-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/church-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
