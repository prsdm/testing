import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSlackUserLookupFromParts,
  getConnectionActionContextChips,
  getConnectionActionOutcomeLabel,
  getConnectionActionResultItems,
  getConnectionActionResultLabel,
  getConnectionActionToolMeta,
  getConnectorToolCallHeader,
  getFirstPendingConnectionActionStreamingLabel,
  isConnectionActionToolPending,
  isConnectorActionToolType,
  resolveSlackRecipientLabel,
  sanitizeConnectorToolInputForDisplay,
  sanitizeConnectorToolOutputForDisplay,
} from "./connector-action-tools";

describe("connector-action-tools", () => {
  it("identifies connection action tool types", () => {
    assert.equal(isConnectorActionToolType("tool-driveUploadFile"), true);
    assert.equal(isConnectorActionToolType("tool-gmailSendMessage"), true);
    assert.equal(isConnectorActionToolType("tool-driveCreateFolder"), true);
    assert.equal(
      isConnectorActionToolType("tool-driveCreateSharedDrive"),
      true
    );
    assert.equal(isConnectorActionToolType("tool-driveMoveFile"), true);
    assert.equal(isConnectorActionToolType("tool-driveUpdateFile"), true);
    assert.equal(isConnectorActionToolType("tool-driveListFolders"), true);
    assert.equal(isConnectorActionToolType("tool-driveSearchFiles"), true);
    assert.equal(isConnectorActionToolType("tool-driveGetFile"), true);
    assert.equal(isConnectorActionToolType("tool-sourceSearch"), false);
  });

  it("uses action-aware outcome labels for write tools and Results for reads", () => {
    assert.equal(
      getConnectionActionOutcomeLabel("tool-slackPostDirectMessage"),
      "Sent"
    );
    assert.equal(
      getConnectionActionOutcomeLabel("tool-jiraCreateIssue"),
      "Created"
    );
    assert.equal(
      getConnectionActionOutcomeLabel("tool-slackSearchMessages"),
      "Searched"
    );
    assert.equal(
      getConnectionActionOutcomeLabel("tool-slackListUsers"),
      "Listed"
    );
    assert.equal(
      getConnectionActionOutcomeLabel("tool-gmailGetMessage"),
      "Read"
    );
  });

  it("returns streaming label for the first pending action", () => {
    const label = getFirstPendingConnectionActionStreamingLabel([
      { state: "input-available", type: "tool-driveCreateFolder" },
    ]);
    assert.equal(label, "Creating Drive folder");
  });

  it("marks action tools as pending until output is available", () => {
    assert.equal(
      isConnectionActionToolPending({
        state: "input-streaming",
        type: "tool-notionCreatePage",
      }),
      true
    );
    assert.equal(
      isConnectionActionToolPending({
        state: "output-available",
        type: "tool-notionCreatePage",
      }),
      false
    );
  });

  it("exposes provider metadata for each action tool", () => {
    assert.equal(
      getConnectionActionToolMeta("tool-confluenceUpdatePage").provider,
      "confluence"
    );
    assert.equal(
      getConnectionActionToolMeta("tool-driveUploadFile").provider,
      "google-drive"
    );
    assert.equal(
      getConnectionActionToolMeta("tool-driveCreateSharedDrive").provider,
      "google-drive"
    );
  });

  it("builds Craft-style connector tool headers", () => {
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: { name: "Finance" },
        isPending: true,
        toolType: "tool-driveCreateFolder",
      }),
      { chip: "Finance", verb: "Creating folder" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: { name: "Finance" },
        isPending: false,
        toolType: "tool-driveCreateFolder",
      }),
      { chip: "Finance", verb: "Created folder" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        denied: true,
        input: { name: "Legal" },
        isPending: false,
        toolType: "tool-driveCreateSharedDrive",
      }),
      { chip: "Legal", verb: "Create shared drive" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: { name: "sample.txt" },
        isPending: true,
        toolType: "tool-driveUploadFile",
      }),
      { chip: "sample.txt", verb: "Creating Drive file" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: { name: "sample.txt" },
        isPending: false,
        toolType: "tool-driveUploadFile",
      }),
      { chip: "sample.txt", verb: "Created Drive file" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: { query: "earnings update" },
        isPending: false,
        toolType: "tool-slackSearchMessages",
      }),
      { chip: "earnings update", verb: "Searched Slack" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: {},
        isPending: false,
        output: {
          users: [
            {
              displayName: "Prasad",
              id: "U1",
              username: "prasad",
            },
          ],
        } as Record<string, unknown>,
        toolType: "tool-slackListUsers",
      }),
      { chip: "Prasad", verb: "Listed Slack users" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: { subject: "MVP updates", to: "support@kimiro.ai" },
        isPending: false,
        toolType: "tool-gmailSendMessage",
      }),
      { chip: "support@kimiro.ai", verb: "Sent email" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        input: { text: "hello", user: "UOBCSRLUM9N" },
        isPending: false,
        output: { userName: "Prasad" },
        toolType: "tool-slackPostDirectMessage",
      }),
      { chip: "Prasad", verb: "Sent Slack direct message" }
    );
    assert.deepEqual(
      getConnectorToolCallHeader({
        denied: true,
        input: { text: "hello", user: "U0BCSRLUM9N" },
        isPending: false,
        slackUserLookup: new Map([["U0BCSRLUM9N", "Prasad"]]),
        toolType: "tool-slackPostDirectMessage",
      }),
      { chip: "Prasad", verb: "Send Slack direct message" }
    );
  });

  it("builds slack user lookup and sanitizes dm input for display", () => {
    const lookup = buildSlackUserLookupFromParts([
      {
        output: {
          users: [
            {
              displayName: "Prasad",
              id: "U0BCSRLUM9N",
              username: "prasad",
            },
          ],
        },
        state: "output-available",
        toolCallId: "users-1",
        type: "tool-slackListUsers",
      },
    ]);

    assert.equal(resolveSlackRecipientLabel("U0BCSRLUM9N", lookup), "Prasad");
    assert.deepEqual(
      sanitizeConnectorToolInputForDisplay(
        { text: "Hi Prasad", user: "U0BCSRLUM9N" },
        {
          slackUserLookup: lookup,
          toolType: "tool-slackPostDirectMessage",
        }
      ),
      { text: "Hi Prasad", user: "Prasad" }
    );
    assert.deepEqual(
      sanitizeConnectorToolInputForDisplay(
        { text: "Hi", user: "U0BCSRLUM9N" },
        { toolType: "tool-slackPostDirectMessage" }
      ),
      { text: "Hi" }
    );
    assert.deepEqual(
      sanitizeConnectorToolOutputForDisplay(
        {
          channelId: "D0BC26L15PE",
          link: "https://kimiro.slack.com/archives/D0BC26L15PE/p1787221446161209",
          text: "what is life",
          ts: "1787221446.161209",
          userId: "U0BCSRLUM9N",
          userName: "Prasad",
        },
        { toolType: "tool-slackPostDirectMessage" }
      ),
      {
        link: "https://kimiro.slack.com/archives/D0BC26L15PE/p1787221446161209",
        text: "what is life",
        userName: "Prasad",
      }
    );
  });

  it("extracts context chips from tool input", () => {
    assert.deepEqual(
      getConnectionActionContextChips("tool-confluenceCreatePage", {
        spaceKey: "ENG",
        title: "Release notes",
      }),
      ["Release notes", "Space ENG"]
    );
    assert.deepEqual(
      getConnectionActionContextChips("tool-driveCreateFolder", {
        name: "Project Assets",
      }),
      ["Project Assets"]
    );
    assert.deepEqual(
      getConnectionActionContextChips("tool-driveMoveFile", {
        fileId: "abc123def456",
      }),
      []
    );
    assert.deepEqual(
      getConnectionActionContextChips("tool-driveMoveFile", {
        fileName: "notes.txt",
        toFolderName: "Legal",
      }),
      ["notes.txt → Legal"]
    );
    assert.deepEqual(
      getConnectionActionContextChips("tool-driveUpdateFile", {
        fileName: "notes.txt",
        name: "final-notes.txt",
      }),
      ["notes.txt", "→ final-notes.txt"]
    );
    assert.deepEqual(
      getConnectionActionContextChips("tool-driveSearchFiles", {
        query: "Finance",
      }),
      ["Finance"]
    );
    assert.deepEqual(
      getConnectionActionContextChips("tool-notionUpdatePage", {
        pageId: "abc123def456",
      }),
      ["abc123def456"]
    );
    assert.deepEqual(
      getConnectionActionContextChips("tool-notionDbUpdateRow", {
        databaseTitle: "Tracker",
        rowTitle: "chat UI bug",
        title: "chat UI bug",
      }),
      ["chat UI bug", "Tracker"]
    );
  });

  it("extracts gmail list/search message subjects as result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-gmailListMessages", {
        messages: [
          {
            id: "msg-1",
            link: "https://mail.google.com/mail/u/0/#inbox/thread-1",
            subject: "Weekly update",
          },
          {
            id: "msg-2",
            link: "https://mail.google.com/mail/u/0/#inbox/thread-2",
            subject: "Invoice reminder",
          },
        ],
        summary: "INBOX · 2 messages",
      }),
      [
        {
          key: "msg-1",
          label: "Weekly update",
          link: "https://mail.google.com/mail/u/0/#inbox/thread-1",
        },
        {
          key: "msg-2",
          label: "Invoice reminder",
          link: "https://mail.google.com/mail/u/0/#inbox/thread-2",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-gmailSearchMessages", {
        messages: [],
        summary: '"invoice" · 0 messages',
      }),
      []
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-gmailSendMessage", {
        summary: "Sent message",
      }),
      []
    );
  });

  it("extracts slack read action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-slackListChannels", {
        channels: [
          { id: "C1", name: "general" },
          { id: "C2", name: "random" },
        ],
        summary: "2 channels",
      }),
      [
        { key: "C1", label: "#general" },
        { key: "C2", label: "#random" },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-slackListUsers", {
        summary: "1 user",
        users: [
          {
            displayName: "Prasad",
            id: "U1",
            username: "prasad",
          },
        ],
      }),
      [{ key: "U1", label: "Prasad" }]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-slackSearchMessages", {
        messages: [
          {
            channelName: "eng",
            permalink:
              "https://workspace.slack.com/archives/C1/p1718890000123456",
            text: "Ship checklist for Friday",
            ts: "1718890000.123456",
          },
        ],
        summary: "1 result",
      }),
      [
        {
          key: "1718890000.123456",
          label: "#eng: Ship checklist for Friday",
          link: "https://workspace.slack.com/archives/C1/p1718890000123456",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-slackGetConversationHistory", {
        messages: [
          {
            permalink:
              "https://workspace.slack.com/archives/C1/p1718890001123456",
            text: "Morning standup starts now",
            ts: "1718890001.123456",
          },
        ],
        summary: "#general · 1 message",
      }),
      [
        {
          key: "1718890001.123456",
          label: "Morning standup starts now",
          link: "https://workspace.slack.com/archives/C1/p1718890001123456",
        },
      ]
    );
  });

  it("extracts slack write action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-slackPostMessage", {
        channelId: "C1",
        channelName: "general",
        link: "https://workspace.slack.com/archives/C1/p1718890000123456",
        summary: "#general",
        text: "Standup starts in five minutes",
        ts: "1718890000.123456",
      }),
      [
        {
          key: "1718890000.123456",
          label: "Standup starts in five minutes",
          link: "https://workspace.slack.com/archives/C1/p1718890000123456",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-slackPostDirectMessage", {
        channelId: "D1",
        link: "https://workspace.slack.com/archives/D1/p1718890001123456",
        text: "Can you review this?",
        ts: "1718890001.123456",
        userId: "U1",
        userName: "Prasad",
      }),
      [
        {
          key: "1718890001.123456",
          label: "Can you review this?",
          link: "https://workspace.slack.com/archives/D1/p1718890001123456",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-slackCreateChannel", {
        channelId: "C9",
        isPrivate: false,
        name: "project-alpha",
      }),
      [{ key: "C9", label: "#project-alpha" }]
    );
  });

  it("extracts jira read action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraListProjects", {
        knowledgeBases: [
          { id: "100", key: "ENG", name: "Engineering" },
          { id: "101", key: "OPS", name: "Operations" },
        ],
        summary: "2 knowledgeBases",
      }),
      [
        { key: "100", label: "ENG: Engineering" },
        { key: "101", label: "OPS: Operations" },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraSearchIssues", {
        issues: [
          {
            id: "200",
            key: "ENG-42",
            summary: "Fix login redirect",
            url: "https://acme.atlassian.net/browse/ENG-42",
          },
        ],
        jql: "project = ENG",
        summary: "1 issue",
      }),
      [
        {
          key: "200",
          label: "ENG-42: Fix login redirect",
          link: "https://acme.atlassian.net/browse/ENG-42",
        },
      ]
    );
  });

  it("extracts jira write action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraGetIssue", {
        id: "200",
        key: "ENG-42",
        summary: "Fix login redirect",
        title: "ENG-42: Fix login redirect",
        url: "https://acme.atlassian.net/browse/ENG-42",
      }),
      [
        {
          key: "200",
          label: "ENG-42: Fix login redirect",
          link: "https://acme.atlassian.net/browse/ENG-42",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraCreateIssue", {
        id: "201",
        key: "ENG-43",
        summary: "New onboarding bug",
        title: "ENG-43: New onboarding bug",
        url: "https://acme.atlassian.net/browse/ENG-43",
      }),
      [
        {
          key: "201",
          label: "ENG-43: New onboarding bug",
          link: "https://acme.atlassian.net/browse/ENG-43",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraUpdateIssue", {
        issueIdOrKey: "ENG-42",
        summary: "Updated ENG-42",
        title: "ENG-42",
        url: "https://acme.atlassian.net/browse/ENG-42",
      }),
      [
        {
          key: "ENG-42",
          label: "Updated ENG-42",
          link: "https://acme.atlassian.net/browse/ENG-42",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraListTransitions", {
        issueIdOrKey: "ENG-42",
        summary: "2 transitions",
        transitions: [
          { id: "11", name: "Start Progress", toStatus: "In Progress" },
          { id: "21", name: "Done", toStatus: "Done" },
        ],
      }),
      [
        { key: "11", label: "Start Progress → In Progress" },
        { key: "21", label: "Done → Done" },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraTransitionIssue", {
        issueIdOrKey: "ENG-42",
        summary: "Transitioned ENG-42",
        url: "https://acme.atlassian.net/browse/ENG-42",
      }),
      [
        {
          key: "ENG-42",
          label: "Transitioned ENG-42",
          link: "https://acme.atlassian.net/browse/ENG-42",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-jiraAddComment", {
        id: "300",
        issueIdOrKey: "ENG-42",
        summary: "Comment on ENG-42",
        url: "https://acme.atlassian.net/browse/ENG-42",
      }),
      [
        {
          key: "300",
          label: "Comment on ENG-42",
          link: "https://acme.atlassian.net/browse/ENG-42",
        },
      ]
    );
  });

  it("extracts google calendar action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-googleCalendarListCalendars", {
        calendars: [
          { id: "primary", primary: true, summary: "prasad@kimiro.ai" },
          { id: "team", summary: "Team Calendar" },
        ],
        summary: "2 calendars",
      }),
      [
        { key: "primary", label: "prasad@kimiro.ai (primary)" },
        { key: "team", label: "Team Calendar" },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-googleCalendarListEvents", {
        events: [
          {
            id: "evt-1",
            link: "https://calendar.google.com/event?eid=abc",
            summary: "Product sync",
            when: "2026-07-10T10:00:00+05:30 → 2026-07-10T11:00:00+05:30",
          },
        ],
        summary: "primary · 1 event",
      }),
      [
        {
          key: "evt-1",
          label: "Product sync",
          link: "https://calendar.google.com/event?eid=abc",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-googleCalendarCreateEvent", {
        id: "evt-2",
        link: "https://calendar.google.com/event?eid=def",
        summary: "Customer call",
        when: "2026-07-11T15:00:00+05:30 → 2026-07-11T16:00:00+05:30",
      }),
      [
        {
          key: "evt-2",
          label: "Customer call",
          link: "https://calendar.google.com/event?eid=def",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-googleCalendarDeleteEvent", {
        deleted: true,
        eventId: "evt-3",
        summary: "Deleted event evt-3",
      }),
      [{ key: "evt-3", label: "Deleted event evt-3" }]
    );
  });

  it("extracts google workspace action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-driveListFolders", {
        folders: [
          {
            id: "folder-1",
            link: "https://drive.google.com/drive/folders/folder-1",
            name: "Finance",
          },
        ],
      }),
      [
        {
          key: "folder-1",
          label: "Finance",
          link: "https://drive.google.com/drive/folders/folder-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-driveCreateFolder", {
        id: "folder-1",
        link: "https://drive.google.com/drive/folders/folder-1",
        name: "Project Assets",
      }),
      [
        {
          key: "folder-1",
          label: "Project Assets",
          link: "https://drive.google.com/drive/folders/folder-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-driveUploadFile", {
        id: "file-1",
        name: "brief.pdf",
        webViewLink: "https://drive.google.com/file/d/file-1/view",
      }),
      [
        {
          key: "file-1",
          label: "brief.pdf",
          link: "https://drive.google.com/file/d/file-1/view",
        },
      ]
    );
  });

  it("extracts notion action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-notionCreatePage", {
        link: "https://www.notion.so/page-1",
        pageId: "page-1",
        parentType: "page",
        title: "Sprint retro notes",
      }),
      [
        {
          key: "page-1",
          label: "Sprint retro notes",
          link: "https://www.notion.so/page-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-notionCreateDatabase", {
        databaseId: "db-1",
        dataSourceId: "ds-1",
        link: "https://www.notion.so/db-1",
        parentType: "page",
        title: "Tasks",
      }),
      [
        {
          key: "db-1",
          label: "Tasks",
          link: "https://www.notion.so/db-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-notionDbCreateRow", {
        databaseId: "db-1",
        dataSourceId: "ds-1",
        link: "https://www.notion.so/row-1",
        rowId: "row-1",
        title: "Fix login bug",
      }),
      [
        {
          key: "row-1",
          label: "Fix login bug",
          link: "https://www.notion.so/row-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-notionDbUpdateRow", {
        databaseId: "db-1",
        link: "https://www.notion.so/row-1",
        rowId: "row-1",
        title: "Fix login bug",
      }),
      [
        {
          key: "row-1",
          label: "Fix login bug",
          link: "https://www.notion.so/row-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-notionMovePage", {
        link: "https://www.notion.so/page-1",
        pageId: "page-1",
        parentPageId: "page-2",
        title: "Sprint retro notes",
      }),
      [
        {
          key: "page-1",
          label: "Sprint retro notes",
          link: "https://www.notion.so/page-1",
        },
      ]
    );
  });

  it("extracts confluence and sharepoint action result items", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-confluenceCreateSpace", {
        link: "https://acme.atlassian.net/wiki/spaces/ENG",
        name: "Engineering",
        spaceId: "space-1",
        spaceKey: "ENG",
      }),
      [
        {
          key: "space-1",
          label: "Engineering",
          link: "https://acme.atlassian.net/wiki/spaces/ENG",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-confluenceCreatePage", {
        link: "https://acme.atlassian.net/wiki/spaces/ENG/pages/page-1",
        pageId: "page-1",
        title: "Release notes",
      }),
      [
        {
          key: "page-1",
          label: "Release notes",
          link: "https://acme.atlassian.net/wiki/spaces/ENG/pages/page-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-confluenceMovePage", {
        link: "https://acme.atlassian.net/wiki/spaces/ENG/pages/page-1",
        pageId: "page-1",
        parentPageId: "page-2",
        title: "Release notes",
      }),
      [
        {
          key: "page-1",
          label: "Release notes",
          link: "https://acme.atlassian.net/wiki/spaces/ENG/pages/page-1",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-sharePointCreatePage", {
        externalRef: "site-1:page-1",
        link: "https://contoso.sharepoint.com/sites/team/SitePages/page-1.aspx",
        pageId: "page-1",
        siteId: "site-1",
        title: "Q4 planning",
      }),
      [
        {
          key: "page-1",
          label: "Q4 planning",
          link: "https://contoso.sharepoint.com/sites/team/SitePages/page-1.aspx",
        },
      ]
    );
    assert.deepEqual(
      getConnectionActionResultItems("tool-sharePointUpdatePage", {
        externalRef: "site-1:page-1",
        link: "https://contoso.sharepoint.com/sites/team/SitePages/page-1.aspx",
        pageId: "page-1",
        siteId: "site-1",
        title: "Q4 planning",
      }),
      [
        {
          key: "page-1",
          label: "Q4 planning",
          link: "https://contoso.sharepoint.com/sites/team/SitePages/page-1.aspx",
        },
      ]
    );
  });

  it("extracts gmail draft result with subject and compose link", () => {
    assert.deepEqual(
      getConnectionActionResultItems("tool-gmailCreateDraft", {
        draftId: "draft-1",
        link: "https://mail.google.com/mail/u/0/#inbox?compose=msg-1",
        messageId: "msg-1",
        subject: "Draft test",
        to: "prasad@kimiro.ai",
      }),
      [
        {
          key: "msg-1",
          label: "Draft test",
          link: "https://mail.google.com/mail/u/0/#inbox?compose=msg-1",
        },
      ]
    );
    assert.equal(
      getConnectionActionResultLabel(
        "tool-gmailCreateDraft",
        {
          subject: "Draft test",
          to: "prasad@kimiro.ai",
        } as Record<string, unknown>,
        { subject: "Draft test", to: "prasad@kimiro.ai" }
      ),
      "Draft test"
    );
  });

  it("prefers output title for result label", () => {
    assert.equal(
      getConnectionActionResultLabel(
        "tool-driveUpdateFile",
        { link: "https://example.com", name: "kimiro starter" },
        { fileId: "abc123def456" }
      ),
      "kimiro starter"
    );
    assert.equal(
      getConnectionActionResultLabel(
        "tool-driveCreateSharedDrive",
        { link: "https://example.com", name: "Team Workspace" },
        { name: "Draft name" }
      ),
      "Team Workspace"
    );
    assert.equal(
      getConnectionActionResultLabel(
        "tool-driveUploadFile",
        { link: "https://example.com", name: "Final file name" },
        { name: "Draft name" }
      ),
      "Final file name"
    );
  });
});
