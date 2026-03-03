import { createServer } from "http";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { createBareServer } from "@tomphttp/bare-server-node";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import wisp from "wisp-server-node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const bareServer = createBareServer("/bare/");
const PORT = process.env.PORT || 3000;

// Allow all CORS
app.use(cors({ origin: "*" }));

// Static UV assets need Cross-Origin-Resource-Policy: cross-origin
// so ANY page (on a different origin) can load these scripts.
// Do NOT apply COEP globally - it breaks cross-origin script loading.
const crossOriginStatic = (root) =>
  express.static(root, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  });

app.use("/uv/", crossOriginStatic(uvPath));
app.use("/epoxy/", crossOriginStatic(epoxyPath));
app.use("/baremux/", crossOriginStatic(baremuxPath));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Root
app.get("/", (req, res) => res.send("UV Backend is live."));

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
  console.log(`UV Backend running on port ${PORT}`);
});
