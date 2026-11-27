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
      favicon: "/favicon.svg",
      head: [
        { tag: "link", attrs: { rel: "icon", href: "/favicon.ico", sizes: "32x32" } },
        { tag: "meta", attrs: { property: "og:image", content: "https://overloadvector.com/social.png" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
      ],
      customCss: ["./src/styles/fonts.css", "./src/styles/graphite.css"],
      // Hero puts Home.astro on the home page, and Header is the site's own on every page
      // (README, The home page).
      components: {
        Footer: "./src/components/Footer.astro",
        Header: "./src/components/Header.astro",
        Hero: "./src/components/Hero.astro",
      },
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
