import { createServer } from "http";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { createBareServer } from "@tomphttp/bare-server-node";
import { createRequire } from "module";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import wisp from "wisp-server-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const app = express();
const bareServer = createBareServer("/bare/");
const PORT = process.env.PORT || 3000;

// CORS — allow any origin so GitHub Pages can talk to this backend
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Bare-Host", "X-Bare-Port", "X-Bare-Protocol", "X-Bare-Path", "X-Bare-Headers", "X-Bare-Forward-Headers"],
}));

// Serve UV static files
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", message: "Evan's proxy is running 🚀" }));

// Root
app.get("/", (req, res) => res.send("Evan's UV Backend is live. Connect your frontend."));

const server = createServer();

server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.endsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
  } else if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`✅ Evan's UV Backend running on port ${PORT}`);
  console.log(`🌐 Bare server at /bare/`);
  console.log(`🔌 Wisp at /wisp/`);
});
