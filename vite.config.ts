import { defineConfig } from "vite";
import { verifySources } from "./scripts/module-identities.ts";
export default defineConfig({
  plugins: [
    {
      name: "trusted-source-identity",
      buildStart() {
        verifySources();
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          try {
            verifySources();
            next();
          } catch (e) {
            res.statusCode = 503;
            res.end(String(e));
          }
        });
      },
    },
  ],
  server: { hmr: false, proxy: { "/api": "http://127.0.0.1:5174" } },
  build: { target: "es2022" },
});
