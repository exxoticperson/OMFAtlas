import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        embed: resolve(root, "embed.html"),
      },
    },
  },
  preview: {
    headers: {
      // Dev/preview smoke for embed iframe (production uses nginx embed location).
      "/embed.html": {
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors *",
      },
    },
  },
});
