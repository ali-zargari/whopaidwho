import type { MetadataRoute } from "next";
import { CYCLES, snapshot } from "@/lib/data";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://whopaidwho.com", changeFrequency: "weekly", priority: 1 },
    { url: "https://whopaidwho.com/methodology", priority: 0.5 },
    { url: "https://whopaidwho.com/accountability", priority: 0.9 },
    { url: "https://whopaidwho.com/races", priority: 0.9 },
    ...CYCLES.flatMap((cycle) =>
      snapshot(cycle).candidates.map((c) => ({
        url: `https://whopaidwho.com/candidate/${c.id}?cycle=${cycle}`,
        lastModified: snapshot(cycle).downloadedAt,
        priority: 0.6,
      })),
    ),
  ];
}
