import express from "express";
import { createServer as createHttpServer } from "http";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = createHttpServer(app);

  // Serve audio assets
  const pathModule = await import("path");
  app.use("/sounds", express.static(
    pathModule.default.resolve(process.cwd(), "richup_assets/sounds")
  ));

  if (process.env.NODE_ENV !== "production") {
    // Dev: proxy through Vite
    const vite = await import("vite");
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    // Prod: serve built files
    const path = await import("path");
    const distPath = path.default.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.default.resolve(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Static server on http://localhost:${PORT}`);
    console.log(`PartyKit handles real-time — run: npx partykit dev`);
  });
}

startServer().catch(console.error);
