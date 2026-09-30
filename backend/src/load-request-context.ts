import * as requestContextModule from "@/core/lib/http/request-context";

export function runWithIncomingMessage<T>(
  req: import("node:http").IncomingMessage,
  fn: () => T
): T {
  const mod = requestContextModule as {
    runWithIncomingMessage?: typeof import("@/core/lib/http/request-context").runWithIncomingMessage;
    default?: {
      runWithIncomingMessage?: typeof import("@/core/lib/http/request-context").runWithIncomingMessage;
    };
  };

  const run = mod.runWithIncomingMessage ?? mod.default?.runWithIncomingMessage;

  if (!run) {
    throw new Error("runWithIncomingMessage export missing");
  }

  return run(req, fn);
}

export function getAppRequestContext():
  | import("@/core/lib/http/request-context").AppRequestContext
  | undefined {
  const mod = requestContextModule as {
    getAppRequestContext?: typeof import("@/core/lib/http/request-context").getAppRequestContext;
    default?: {
      getAppRequestContext?: typeof import("@/core/lib/http/request-context").getAppRequestContext;
    };
  };

  const getter = mod.getAppRequestContext ?? mod.default?.getAppRequestContext;

  if (!getter) {
    throw new Error("getAppRequestContext export missing");
  }

  return getter();
}
