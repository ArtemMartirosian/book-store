import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Գրքասեր · Grqaser", short_name: "Գրքասեր", lang: "hy",
    description: "Առցանց գրախանութ՝ առաքմամբ Երևանում։",
    start_url: "/hy", scope: "/", display: "standalone",
    theme_color: "#173d32", background_color: "#f7f5f0",
    icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
