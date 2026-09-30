import type { Application, Request, Response } from "express";
import { runWithIncomingMessage } from "../load-request-context";
import { expressRequestToWebRequest, sendWebResponse } from "../web-response";

type RouteParams = Record<string, string>;

type WebRequest = globalThis.Request;
type WebResponse = globalThis.Response;

type AppRouteModule = {
  GET?: (
    request: WebRequest,
    context: { params: Promise<RouteParams> }
  ) => Promise<WebResponse> | WebResponse;
  POST?: (
    request: WebRequest,
    context: { params: Promise<RouteParams> }
  ) => Promise<WebResponse> | WebResponse;
  PATCH?: (
    request: WebRequest,
    context: { params: Promise<RouteParams> }
  ) => Promise<WebResponse> | WebResponse;
  PUT?: (
    request: WebRequest,
    context: { params: Promise<RouteParams> }
  ) => Promise<WebResponse> | WebResponse;
  DELETE?: (
    request: WebRequest,
    context: { params: Promise<RouteParams> }
  ) => Promise<WebResponse> | WebResponse;
};

const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

function resolveRouteModule(
  module: AppRouteModule | { default?: AppRouteModule }
): AppRouteModule {
  if ("default" in module && module.default) {
    return module.default;
  }
  return module as AppRouteModule;
}

export function mountAppRoute(
  app: Application,
  expressPath: string,
  module:
    | AppRouteModule
    | { default?: AppRouteModule }
    | Record<string, unknown>
) {
  const routeModule = resolveRouteModule(
    module as AppRouteModule | { default?: AppRouteModule }
  );
  for (const method of HTTP_METHODS) {
    const handler = routeModule[method];
    if (!handler) {
      continue;
    }

    app[method.toLowerCase() as Lowercase<typeof method>](
      expressPath,
      (req: Request, res: Response) => {
        runWithIncomingMessage(req, () => {
          void (async () => {
            try {
              const webRequest = expressRequestToWebRequest(req);
              const params: RouteParams = { ...req.params };
              const result = await handler.call(routeModule, webRequest, {
                params: Promise.resolve(params),
              });
              await sendWebResponse(res, result);
            } catch (error) {
              console.error(`[${method} ${expressPath}]`, error);
              if (!res.headersSent) {
                res.status(500).json({ error: "Internal server error" });
              }
            }
          })();
        });
      }
    );
  }
}
