// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://overloadvector.com",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Overload Vector",
      description: "A strength-training app for Android: a periodized program, logging, progression and coaching with Claude.",
      logo: { src: "./src/assets/icon.svg" },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/fonts.css", "./src/styles/graphite.css"],
      components: { Footer: "./src/components/Footer.astro" },
      pagination: false,
      sidebar: [
        {
          label: "Docs",
          items: [
            "docs/getting-started",
            "docs/logging",
            "docs/progression",
            "docs/programs",
            "docs/program-format",
            "docs/gyms",
            "docs/gym-format",
            "docs/coaching",
            "docs/backups",
            "docs/free-and-full",
          ],
        },
        { label: "Help", items: ["faq", "contact", "privacy"] },
      ],
    }),
  ],
});
