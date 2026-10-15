import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

const EMBED_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors *";

/**
 * Dev/preview smoke for the embed iframe (production uses an nginx location).
 * Vite's `preview.headers` takes header names, not paths, so a per-path
 * policy there throws on every request; a middleware is the supported way to
 * give one page a different policy.
 */
function embedCsp() {
  const middleware = (request, response, next) => {
    if (new URL(request.url, "http://localhost").pathname === "/embed.html")
      response.setHeader("Content-Security-Policy", EMBED_CSP);
    next();
  };
  return {
    name: "embed-csp",
    // Block bodies on purpose: a returned value is read as a post hook.
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  appType: "mpa",
  server: {
    host: "127.0.0.1",
    port: 3016,
    // Fail loudly when 3016 is taken — Vite must not silently hop to 3017+.
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        embed: resolve(root, "embed.html"),
      },
    },
  },
  plugins: [embedCsp()],
});
