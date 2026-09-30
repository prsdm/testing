import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterVisibleItemsByAgentKbScope,
  resolveHybridAccessForAgentKbScope,
} from "./source-agent-scope";

describe("agent kb scope ∩ user acl", () => {
  const visible = [
    { id: "kb-a", title: "A" },
    { id: "kb-b", title: "B" },
    { id: "kb-c", title: "C" },
  ];

  it("returns all visible items when agent has no kb scope", () => {
    assert.deepEqual(filterVisibleItemsByAgentKbScope(visible, null), visible);
    assert.deepEqual(filterVisibleItemsByAgentKbScope(visible, []), visible);
  });

  it("limits results to agent allowed ids after acl filtering", () => {
    const scoped = filterVisibleItemsByAgentKbScope(visible, ["kb-a", "kb-z"]);
    assert.deepEqual(
      scoped.map((item) => item.id),
      ["kb-a"]
    );
  });

  it("returns empty when user-visible items are outside agent scope", () => {
    assert.deepEqual(filterVisibleItemsByAgentKbScope(visible, ["kb-z"]), []);
  });
});

describe("resolveHybridAccessForAgentKbScope", () => {
  const liveOn = {
    calendar: true,
    gmail: true,
    jira: true,
    slack: true,
  };

  it("passes through live + indexed slack when agent is not kb-scoped", () => {
    const access = resolveHybridAccessForAgentKbScope({
      liveSources: liveOn,
    });
    assert.deepEqual(access.liveSources, liveOn);
    assert.equal(access.includeIndexedSlack, true);
  });

  it("disables live and indexed slack when agent has kb item allowlist", () => {
    const access = resolveHybridAccessForAgentKbScope({
      allowedSourceItemIds: ["kb-a"],
      liveSources: liveOn,
    });
    assert.deepEqual(access.liveSources, {
      calendar: false,
      gmail: false,
      jira: false,
      slack: false,
    });
    assert.equal(access.includeIndexedSlack, false);
  });

  it("allows indexed slack only when source-type scope includes slack", () => {
    const withoutSlack = resolveHybridAccessForAgentKbScope({
      allowedSourceConnectorTypes: ["notion"],
      liveSources: liveOn,
    });
    assert.equal(withoutSlack.includeIndexedSlack, false);
    assert.equal(withoutSlack.liveSources.slack, false);

    const withSlack = resolveHybridAccessForAgentKbScope({
      allowedSourceConnectorTypes: ["slack"],
      liveSources: liveOn,
    });
    assert.equal(withSlack.includeIndexedSlack, true);
    assert.equal(withSlack.liveSources.slack, false);
  });
});
