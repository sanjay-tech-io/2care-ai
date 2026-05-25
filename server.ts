import "./config/env";

import dotenv from "dotenv";
dotenv.config();


import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./backend/routes/api_routes";
import { voiceSocketBroker } from "./backend/websocket/voice_socket";
import { redisStore } from "./database/redis/redis_service";

const PORT = Number(process.env.PORT) || 4000;
const app = express();

app.use(express.json());

// Mount the modular clinical REST endpoints API
app.use("/api", apiRouter);

// ================================================
// PART A: Get Chat History Endpoint
// ================================================
app.get('/api/chat-history/:phone', async (req, res) => {
  const { phone } = req.params;
  try {
    const historyRaw = await redisStore.hget(`session:${phone}`, 'chatHistory');
    const history = historyRaw ? JSON.parse(historyRaw) : [];
    res.json({ success: true, history });
  } catch (e) {
    res.json({ success: true, history: [] });
  }
});

// Initialize HTTP server
const server = http.createServer(app);

// Initialize WebSocket voice brokers
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  voiceSocketBroker.handleConnection(ws);
});

// Coordinate pipeline upgrades
server.on("upgrade", (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
  if (pathname === "/api/voice") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Bootstrapper with Vite Spa capability fallback
async function bootstrapServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[OK] Fullstack Clinical Voice AI Agent server boot completed at http://0.0.0.0:${PORT}`);
  });
}

bootstrapServer();
export default app;
