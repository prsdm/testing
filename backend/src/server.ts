import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import { attachWorkspaceInboxWebSocket } from "@/core/lib/chat/chat-inbox-ws";
import { attachChatRoomWebSocket } from "@/core/lib/chat/chat-room-ws";
import { loadAuthInstance } from "./load-auth-instance";
import { runWithIncomingMessage } from "./load-request-context";
import { handleSsoStartRequest } from "./load-sso-start";
import { registerRoutes } from "./routes";
import { validateProductionEnv } from "./validate-production-env";
import { expressRequestToWebRequest, sendWebResponse } from "./web-response";

validateProductionEnv();

const port = Number(
  process.env.KIMIRO_API_PORT ?? process.env.API_PORT ?? 3002
);
const webOrigin =
  process.env.KIMIRO_WEB_ORIGIN?.trim() ?? "http://localhost:5173";

const app = express();
app.set("trust proxy", 1);
const authInstance = loadAuthInstance();
const authHandler = toNodeHandler(authInstance);

app.use(
  cors({
    credentials: true,
    origin: [webOrigin, process.env.BETTER_AUTH_URL].filter(
      Boolean
    ) as string[],
  })
);

app.use((req, _res, next) => {
  runWithIncomingMessage(req, () => next());
});

app.get("/ping", (_req, res) => {
  res.status(200).send("pong");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kimiro-api" });
});

app.all("/api/auth/*", (req, res) => {
  Promise.resolve(authHandler(req, res)).catch((error) => {
    console.error("[auth]", error);
    if (!res.headersSent) {
      res.status(500).end();
    }
  });
});

app.get("/api/sign-in-options", (_req, res) => {
  res.json({
    googleEnabled: Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim()
    ),
    microsoftEnabled: Boolean(
      process.env.MICROSOFT_CLIENT_ID?.trim() &&
        process.env.MICROSOFT_CLIENT_SECRET?.trim()
    ),
  });
});

app.post(
  "/api/sso/start",
  express.json({ limit: "64kb" }),
  async (req, res) => {
    try {
      const webRequest = expressRequestToWebRequest(req);
      const webResponse = await handleSsoStartRequest(webRequest);
      await sendWebResponse(res, webResponse);
    } catch (error) {
      console.error("sso/start failed", error);
      res.status(500).json({ error: "Unable to start SSO right now." });
    }
  }
);

registerRoutes(app);

const server = app.listen(port, () => {
  console.info(`Kimiro API listening on http://127.0.0.1:${port}`);
});

attachChatRoomWebSocket(server);
attachWorkspaceInboxWebSocket(server);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
