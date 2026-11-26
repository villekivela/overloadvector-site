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
    }),
  ],
});
