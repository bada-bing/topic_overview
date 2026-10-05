import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [solid()],
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:4310" },
  },
});
