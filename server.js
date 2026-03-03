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
import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const bareServer = createBareServer("/bare/");
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));

// UV static assets
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/", (req, res) => res.send("UV Backend is live."));

// ── ASSET PROXY ──────────────────────────────────────────────────
// GET /asset?url=https://example.com/style.css
// Fetches the asset and streams it back with correct content-type.
// Lets the srcdoc iframe load CSS/JS/images from external origins.
app.get("/asset", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing url param");

  let parsed;
  try { parsed = new URL(target); } catch { return res.status(400).send("Bad URL"); }

  const lib = parsed.protocol === "https:" ? httpsRequest : httpRequest;

  const proxyReq = lib({
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "*/*",
      "Referer": parsed.origin + "/",
    },
  }, (proxyRes) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", proxyRes.headers["content-type"] || "application/octet-stream");
    res.writeHead(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (e) => {
    if (!res.headersSent) res.status(502).send("Upstream error: " + e.message);
  });
  proxyReq.end();
});

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
