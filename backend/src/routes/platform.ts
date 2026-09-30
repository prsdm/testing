import type { Application } from "express";
import * as authGuestRoute from "@/core/server/api/auth/guest/route";
import * as cronChatRetentionRoute from "@/core/server/api/cron/chat-retention/route";
import * as cronSourcesAclRefreshRoute from "@/core/server/api/cron/sources-acl-refresh/route";
import * as setupRoute from "@/core/server/api/setup/route";
import * as slackEventsRoute from "@/core/server/api/slack/events/route";
import * as slackInteractionsRoute from "@/core/server/api/slack/interactions/route";
import * as slackOauthCallbackRoute from "@/core/server/api/slack/oauth/callback/route";
import * as slackOauthInstallRoute from "@/core/server/api/slack/oauth/install/route";
import * as stripeWebhookRoute from "@/core/server/api/stripe/webhook/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(app, "/api/auth/guest", authGuestRoute);
  mountAppRoute(app, "/api/stripe/webhook", stripeWebhookRoute);
  mountAppRoute(app, "/api/slack/events", slackEventsRoute);
  mountAppRoute(app, "/api/slack/interactions", slackInteractionsRoute);
  mountAppRoute(app, "/api/slack/oauth/install", slackOauthInstallRoute);
  mountAppRoute(app, "/api/slack/oauth/callback", slackOauthCallbackRoute);
  mountAppRoute(app, "/api/cron/chat-retention", cronChatRetentionRoute);
  mountAppRoute(
    app,
    "/api/cron/sources-acl-refresh",
    cronSourcesAclRefreshRoute
  );
  mountAppRoute(app, "/api/setup", setupRoute);
}
