import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Գրքասեր · Grqaser", short_name: "Գրքասեր", lang: "hy",
    description: "Առցանց գրախանութ՝ առաքմամբ Երևանում։",
    start_url: "/hy", scope: "/", display: "standalone",
    theme_color: "#6258ff", background_color: "#f7f8fc",
    icons: [{ src: "/brand/icon-192.png?v=violet-20260924", sizes: "192x192", type: "image/png" }, { src: "/brand/icon-512.png?v=violet-20260924", sizes: "512x512", type: "image/png" }],
  };
}
