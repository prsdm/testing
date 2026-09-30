import type { Application } from "express";
import { mount as mountAdmin } from "./admin";
import { mount as mountChannels } from "./channels";
import { mount as mountChat } from "./chat";
import { mount as mountConnectors } from "./connectors";
import { mount as mountDms } from "./dms";
import { mount as mountKnowledgeBases } from "./knowledge-bases";
import { mount as mountLibrary } from "./library";
import { mount as mountPlatform } from "./platform";

/** Attach all HTTP API routes to the Express app. */
export function registerRoutes(app: Application) {
  mountChat(app);
  mountChannels(app);
  mountDms(app);
  mountLibrary(app);
  mountConnectors(app);
  mountKnowledgeBases(app);
  mountAdmin(app);
  mountPlatform(app);
}
