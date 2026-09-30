import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgVector768 } from "@/core/lib/db/pg-vector";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending_setup",
  "active",
  "suspended",
]);

export const authUser = pgTable("user", {
  createdAt: timestamp("createdAt").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  id: text("id").primaryKey().notNull(),
  image: text("image"),
  name: text("name"),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const authSession = pgTable("session", {
  createdAt: timestamp("createdAt").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  id: text("id").primaryKey().notNull(),
  ipAddress: text("ipAddress"),
  token: text("token").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
});

export const authAccount = pgTable("account", {
  accessToken: text("accessToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  accountId: text("accountId").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  id: text("id").primaryKey().notNull(),
  idToken: text("idToken"),
  password: text("password"),
  providerId: text("providerId").notNull(),
  refreshToken: text("refreshToken"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  updatedAt: timestamp("updatedAt").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
});

export const authVerification = pgTable("verification", {
  createdAt: timestamp("createdAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  id: text("id").primaryKey().notNull(),
  identifier: text("identifier").notNull(),
  updatedAt: timestamp("updatedAt"),
  value: text("value").notNull(),
});

export const authSsoProvider = pgTable("ssoProvider", {
  createdAt: timestamp("createdAt"),
  domain: text("domain").notNull(),
  domainVerified: boolean("domainVerified"),
  id: text("id").primaryKey().notNull(),
  issuer: text("issuer").notNull(),
  oidcConfig: text("oidcConfig"),
  organizationId: text("organizationId"),
  providerId: text("providerId").notNull(),
  samlConfig: text("samlConfig"),
  updatedAt: timestamp("updatedAt"),
  userId: text("userId").references(() => authUser.id, { onDelete: "cascade" }),
});

export const ssoProviderEnum = pgEnum("sso_provider", [
  "google_workspace",
  "okta",
  "azure_ad",
]);

export const ssoConfigStatusEnum = pgEnum("sso_config_status", [
  "pending",
  "active",
  "disabled",
]);

export const tenants = pgTable(
  "Tenant",
  {
    companyName: text("companyName").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    /** Self-serve billing owner — at most one non-null per auth user. */
    ownerAuthUserId: text("ownerAuthUserId").references(() => authUser.id, {
      onDelete: "set null",
    }),
    primaryDomain: varchar("primaryDomain", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    status: tenantStatusEnum("status").notNull().default("pending_setup"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: unique("tenant_slug_unique").on(table.slug),
  })
);

export type Tenant = InferSelectModel<typeof tenants>;

export const tenantGeneralSettings = pgTable("TenantGeneralSettings", {
  logoUrl: text("logoUrl"),
  maximumChatRetentionDays: integer("maximumChatRetentionDays"),
  sandboxEnabled: boolean("sandboxEnabled").notNull().default(true),
  sandboxWorkSkillsEnabled: jsonb("sandboxWorkSkillsEnabled")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({
      slides: true,
      xlsx: true,
    }),
  tenantId: uuid("tenantId")
    .primaryKey()
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  workspacePrompt: text("workspacePrompt"),
});

export type TenantGeneralSettings = InferSelectModel<
  typeof tenantGeneralSettings
>;

export const tenantDomains = pgTable(
  "TenantDomain",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    domain: varchar("domain", { length: 255 }).notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
    verifiedAt: timestamp("verifiedAt"),
  },
  (table) => ({
    domainUnique: unique("tenant_domain_unique").on(table.domain),
  })
);

export type TenantDomain = InferSelectModel<typeof tenantDomains>;

export const tenantAdminContacts = pgTable(
  "TenantAdminContact",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    email: varchar("email", { length: 255 }).notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
  },
  (table) => ({
    emailUniquePerTenant: unique("tenant_admin_contact_unique").on(
      table.tenantId,
      table.email
    ),
  })
);

export type TenantAdminContact = InferSelectModel<typeof tenantAdminContacts>;

export const tenantSsoConfigs = pgTable("TenantSSOConfig", {
  clientId: text("clientId").notNull(),
  clientSecretEncrypted: text("clientSecretEncrypted").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  issuerUrl: text("issuerUrl").notNull(),
  metadata: jsonb("metadata"),
  provider: ssoProviderEnum("provider").notNull(),
  status: ssoConfigStatusEnum("status").notNull().default("pending"),
  tenantId: uuid("tenantId")
    .notNull()
    .references(() => tenants.id),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantSSOConfig = InferSelectModel<typeof tenantSsoConfigs>;

export const tenantSetupTokens = pgTable(
  "TenantSetupToken",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    expiresAt: timestamp("expiresAt").notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
    tokenHash: text("tokenHash").notNull(),
    usedAt: timestamp("usedAt"),
  },
  (table) => ({
    tokenHashUnique: unique("tenant_setup_token_hash_unique").on(
      table.tokenHash
    ),
  })
);

export type TenantSetupToken = InferSelectModel<typeof tenantSetupTokens>;

export const peopleSyncSourceEnum = pgEnum("people_sync_source", ["idp_pull"]);

export const peopleSyncStatusEnum = pgEnum("people_sync_status", [
  "active",
  "inactive",
  "error",
]);

export const tenantIdentities = pgTable(
  "TenantIdentity",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    email: varchar("email", { length: 255 }).notNull(),
    externalId: text("externalId"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    issuer: text("issuer").notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    provider: ssoProviderEnum("provider").notNull(),
    source: peopleSyncSourceEnum("source").notNull().default("idp_pull"),
    subject: text("subject").notNull(),
    syncStatus: peopleSyncStatusEnum("syncStatus").notNull().default("active"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
    userData: json("userData"),
  },
  (table) => ({
    providerSubjectUnique: unique("tenant_identity_provider_subject_unique").on(
      table.tenantId,
      table.issuer,
      table.subject
    ),
  })
);

export type TenantIdentity = InferSelectModel<typeof tenantIdentities>;

export const tenantPeople = pgTable(
  "TenantPerson",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    department: varchar("department", { length: 255 }),
    displayName: varchar("displayName", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    externalId: text("externalId"),
    firstName: varchar("firstName", { length: 255 }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    lastName: varchar("lastName", { length: 255 }),
    lastSyncedAt: timestamp("lastSyncedAt").notNull().defaultNow(),
    location: varchar("location", { length: 255 }),
    managerEmail: varchar("managerEmail", { length: 255 }),
    source: peopleSyncSourceEnum("source").notNull().default("idp_pull"),
    status: peopleSyncStatusEnum("status").notNull().default("active"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
    title: varchar("title", { length: 255 }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantEmailUnique: unique("tenant_person_tenant_email_unique").on(
      table.tenantId,
      table.email
    ),
  })
);

export type TenantPerson = InferSelectModel<typeof tenantPeople>;

export const tenantPeopleGroups = pgTable(
  "TenantPeopleGroup",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    externalId: text("externalId"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantGroupNameUnique: unique("tenant_people_group_tenant_name_unique").on(
      table.tenantId,
      table.name
    ),
  })
);

export type TenantPeopleGroup = InferSelectModel<typeof tenantPeopleGroups>;

export const tenantPeopleGroupMembers = pgTable(
  "TenantPeopleGroupMember",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    groupId: uuid("groupId")
      .notNull()
      .references(() => tenantPeopleGroups.id),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    personId: uuid("personId")
      .notNull()
      .references(() => tenantPeople.id),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
  },
  (table) => ({
    tenantGroupPersonUnique: unique("tenant_people_group_member_unique").on(
      table.tenantId,
      table.groupId,
      table.personId
    ),
  })
);

export type TenantPeopleGroupMember = InferSelectModel<
  typeof tenantPeopleGroupMembers
>;

export const peopleSyncRunStatusEnum = pgEnum("people_sync_run_status", [
  "running",
  "success",
  "partial",
  "failed",
]);

export const tenantPeopleSyncRuns = pgTable("TenantPeopleSyncRun", {
  completedAt: timestamp("completedAt"),
  errorsCount: bigint("errorsCount", { mode: "number" }).notNull().default(0),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  metadata: jsonb("metadata"),
  provider: ssoProviderEnum("provider").notNull(),
  source: peopleSyncSourceEnum("source").notNull(),
  startedAt: timestamp("startedAt").notNull().defaultNow(),
  status: peopleSyncRunStatusEnum("status").notNull().default("running"),
  tenantId: uuid("tenantId")
    .notNull()
    .references(() => tenants.id),
  usersDeactivated: bigint("usersDeactivated", { mode: "number" })
    .notNull()
    .default(0),
  usersProcessed: bigint("usersProcessed", { mode: "number" })
    .notNull()
    .default(0),
  usersUpserted: bigint("usersUpserted", { mode: "number" })
    .notNull()
    .default(0),
});

export type TenantPeopleSyncRun = InferSelectModel<typeof tenantPeopleSyncRuns>;

export const tenantPeopleSyncIssues = pgTable("TenantPeopleSyncIssue", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  externalId: text("externalId"),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  issueCode: varchar("issueCode", { length: 100 }).notNull(),
  issueMessage: text("issueMessage").notNull(),
  personEmail: varchar("personEmail", { length: 255 }),
  resolvedAt: timestamp("resolvedAt"),
  tenantId: uuid("tenantId")
    .notNull()
    .references(() => tenants.id),
});

export type TenantPeopleSyncIssue = InferSelectModel<
  typeof tenantPeopleSyncIssues
>;

export const tenantMemberRoleEnum = pgEnum("tenant_member_role", [
  "admin",
  "basic",
]);

export const tenantMembers = pgTable(
  "TenantMember",
  {
    authUserId: text("authUserId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    department: varchar("department", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    isActive: boolean("isActive").notNull().default(true),
    jobTitle: varchar("jobTitle", { length: 255 }),
    lastLoginAt: timestamp("lastLoginAt"),
    personId: uuid("personId").references(() => tenantPeople.id, {
      onDelete: "set null",
    }),
    preferredName: varchar("preferredName", { length: 255 }),
    profileOnboardingCompletedAt: timestamp("profileOnboardingCompletedAt"),
    role: tenantMemberRoleEnum("role").notNull().default("basic"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantAuthUserUnique: unique("tenant_member_tenant_auth_user_unique").on(
      table.tenantId,
      table.authUserId
    ),
    tenantEmailUnique: unique("tenant_member_tenant_email_unique").on(
      table.tenantId,
      table.email
    ),
  })
);

export type TenantMember = InferSelectModel<typeof tenantMembers>;

export const tenantInvites = pgTable(
  "TenantInvite",
  {
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    email: varchar("email", { length: 255 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    invitedByAuthUserId: text("invitedByAuthUserId").references(
      () => authUser.id,
      { onDelete: "set null" }
    ),
    revokedAt: timestamp("revokedAt"),
    role: tenantMemberRoleEnum("role").notNull().default("basic"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
  },
  (table) => ({
    tenantEmailIdx: index("tenant_invite_tenant_email_idx").on(
      table.tenantId,
      table.email
    ),
    tokenHashUnique: unique("tenant_invite_token_hash_unique").on(
      table.tokenHash
    ),
  })
);

export type TenantInvite = InferSelectModel<typeof tenantInvites>;

export const tenantCustomRoles = pgTable(
  "TenantCustomRole",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    description: text("description"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantRoleNameUnique: unique("tenant_custom_role_tenant_name_unique").on(
      table.tenantId,
      table.name
    ),
  })
);

export type TenantCustomRole = InferSelectModel<typeof tenantCustomRoles>;

export const tenantCustomRoleCapabilities = pgTable(
  "TenantCustomRoleCapability",
  {
    capability: varchar("capability", { length: 64 }).notNull(),
    roleId: uuid("roleId")
      .notNull()
      .references(() => tenantCustomRoles.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.capability] }),
  })
);

export type TenantCustomRoleCapability = InferSelectModel<
  typeof tenantCustomRoleCapabilities
>;

export const tenantMemberCustomRoles = pgTable(
  "TenantMemberCustomRole",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    memberId: uuid("memberId")
      .notNull()
      .references(() => tenantMembers.id, { onDelete: "cascade" }),
    roleId: uuid("roleId")
      .notNull()
      .references(() => tenantCustomRoles.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.memberId, table.roleId] }),
  })
);

export type TenantMemberCustomRole = InferSelectModel<
  typeof tenantMemberCustomRoles
>;

export const securityAuditEvents = pgTable("SecurityAuditEvent", {
  action: varchar("action", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  email: varchar("email", { length: 320 }),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  ipAddress: varchar("ipAddress", { length: 128 }),
  metadata: jsonb("metadata"),
  resource: varchar("resource", { length: 512 }),
  tenantId: uuid("tenantId").references(() => tenants.id),
  userAgent: text("userAgent"),
  userId: text("userId"),
});

export type SecurityAuditEvent = InferSelectModel<typeof securityAuditEvents>;

export const indexRunStatusEnum = pgEnum("index_run_status", [
  "running",
  "success",
  "partial",
  "failed",
]);

export const indexSourceTypeEnum = pgEnum("index_source_type", [
  "google_drive",
]);

export const tenantSearchSettings = pgTable("TenantSearchSettings", {
  embeddingDimension: bigint("embeddingDimension", { mode: "number" })
    .notNull()
    .default(768),
  embeddingModel: varchar("embeddingModel", { length: 255 })
    .notNull()
    .default("BAAI/bge-base-en-v1.5"),
  indexingEnabled: boolean("indexingEnabled").notNull().default(true),
  maxContextLength: bigint("maxContextLength", { mode: "number" })
    .notNull()
    .default(512),
  maxIndexedContentSizeMb: bigint("maxIndexedContentSizeMb", { mode: "number" })
    .notNull()
    .default(10),
  normalizeEmbeddings: boolean("normalizeEmbeddings").notNull().default(true),
  passagePrefix: varchar("passagePrefix", { length: 64 }).notNull().default(""),
  queryPrefix: varchar("queryPrefix", { length: 64 })
    .notNull()
    .default("Represent this sentence for searching relevant passages: "),
  tenantId: uuid("tenantId")
    .primaryKey()
    .references(() => tenants.id),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantSearchSettings = InferSelectModel<
  typeof tenantSearchSettings
>;

export const tenantIndexRuns = pgTable("TenantIndexRun", {
  chunksIndexed: bigint("chunksIndexed", { mode: "number" })
    .notNull()
    .default(0),
  completedAt: timestamp("completedAt"),
  documentsIndexed: bigint("documentsIndexed", { mode: "number" })
    .notNull()
    .default(0),
  errorMessage: text("errorMessage"),
  errorsCount: bigint("errorsCount", { mode: "number" }).notNull().default(0),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  metadata: jsonb("metadata"),
  sourceType: indexSourceTypeEnum("sourceType")
    .notNull()
    .default("google_drive"),
  startedAt: timestamp("startedAt").notNull().defaultNow(),
  status: indexRunStatusEnum("status").notNull().default("running"),
  tenantId: uuid("tenantId")
    .notNull()
    .references(() => tenants.id),
});

export type TenantIndexRun = InferSelectModel<typeof tenantIndexRuns>;

/** Drive workspace groups, folders, shared drives — user ↔ external group membership. */
export const tenantDriveUserExternalGroups = pgTable(
  "TenantDriveUserExternalGroup",
  {
    externalGroupId: varchar("externalGroupId", { length: 512 }).notNull(),
    stale: boolean("stale").notNull().default(false),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    userEmail: varchar("userEmail", { length: 320 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.tenantId, table.userEmail, table.externalGroupId],
    }),
  })
);

export type TenantDriveUserExternalGroup = InferSelectModel<
  typeof tenantDriveUserExternalGroups
>;

/** Folder/drive groups that grant link-wide access. */
export const tenantDrivePublicExternalGroups = pgTable(
  "TenantDrivePublicExternalGroup",
  {
    externalGroupId: varchar("externalGroupId", { length: 512 }).notNull(),
    stale: boolean("stale").notNull().default(false),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.externalGroupId] }),
  })
);

export type TenantDrivePublicExternalGroup = InferSelectModel<
  typeof tenantDrivePublicExternalGroups
>;

/** Confluence / SharePoint external group membership for permissions graph. */
export const tenantConnectorUserExternalGroups = pgTable(
  "TenantConnectorUserExternalGroup",
  {
    externalGroupId: varchar("externalGroupId", { length: 512 }).notNull(),
    sourceType: varchar("sourceType", { length: 32 }).notNull(),
    stale: boolean("stale").notNull().default(false),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    userEmail: varchar("userEmail", { length: 320 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.tenantId,
        table.sourceType,
        table.userEmail,
        table.externalGroupId,
      ],
    }),
  })
);

export type TenantConnectorUserExternalGroup = InferSelectModel<
  typeof tenantConnectorUserExternalGroups
>;

/** Per-file index state for incremental Drive sync (modifiedTime checkpoint). */
export const tenantDriveIndexedFiles = pgTable(
  "TenantDriveIndexedFile",
  {
    documentId: varchar("documentId", { length: 160 }).notNull(),
    driveFileId: varchar("driveFileId", { length: 128 }).notNull(),
    driveModifiedTime: varchar("driveModifiedTime", { length: 64 }).notNull(),
    lastIndexedAt: timestamp("lastIndexedAt").notNull().defaultNow(),
    lastStatus: varchar("lastStatus", { length: 32 })
      .notNull()
      .default("indexed"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.driveFileId] }),
  })
);

export type TenantDriveIndexedFile = InferSelectModel<
  typeof tenantDriveIndexedFiles
>;

/** Per-channel index state for incremental Slack sync (newest message ts). */
export const tenantSlackIndexedChannels = pgTable(
  "TenantSlackIndexedChannel",
  {
    channelId: varchar("channelId", { length: 64 }).notNull(),
    channelName: varchar("channelName", { length: 255 }),
    /** Auth user who last successfully indexed this channel (delete ownership). */
    indexedByUserId: text("indexedByUserId").references(() => authUser.id, {
      onDelete: "set null",
    }),
    lastIndexedAt: timestamp("lastIndexedAt").notNull().defaultNow(),
    lastMessageTs: varchar("lastMessageTs", { length: 64 })
      .notNull()
      .default(""),
    lastStatus: varchar("lastStatus", { length: 32 })
      .notNull()
      .default("indexed"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.channelId] }),
  })
);

export type TenantSlackIndexedChannel = InferSelectModel<
  typeof tenantSlackIndexedChannels
>;

/** Admin-configured Google Drive actions (personal OAuth per user). */
export const tenantDriveActionsSettings = pgTable(
  "TenantDriveActionsSettings",
  {
    allowRead: boolean("allowRead").notNull().default(true),
    credentialMode: varchar("credentialMode", { length: 16 })
      .notNull()
      .default("managed"),
    oauthClientId: varchar("oauthClientId", { length: 512 }),
    oauthClientSecretEncrypted: text("oauthClientSecretEncrypted"),
    tenantId: uuid("tenantId")
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  }
);

export type TenantDriveActionsSettings = InferSelectModel<
  typeof tenantDriveActionsSettings
>;

/** Admin-configured Confluence actions (user credentials remain personal). */
export const tenantConfluenceActionsSettings = pgTable(
  "TenantConfluenceActionsSettings",
  {
    allowRead: boolean("allowRead").notNull().default(true),
    credentialMode: varchar("credentialMode", { length: 16 })
      .notNull()
      .default("managed"),
    oauthClientId: varchar("oauthClientId", { length: 512 }),
    oauthClientSecretEncrypted: text("oauthClientSecretEncrypted"),
    siteUrl: varchar("siteUrl", { length: 512 }),
    tenantId: uuid("tenantId")
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  }
);

export type TenantConfluenceActionsSettings = InferSelectModel<
  typeof tenantConfluenceActionsSettings
>;

/** Admin-configured Notion actions (user credentials remain personal). */
export const tenantNotionActionsSettings = pgTable(
  "TenantNotionActionsSettings",
  {
    allowRead: boolean("allowRead").notNull().default(true),
    credentialMode: varchar("credentialMode", { length: 16 })
      .notNull()
      .default("managed"),
    oauthClientId: varchar("oauthClientId", { length: 512 }),
    oauthClientSecretEncrypted: text("oauthClientSecretEncrypted"),
    tenantId: uuid("tenantId")
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  }
);

export type TenantNotionActionsSettings = InferSelectModel<
  typeof tenantNotionActionsSettings
>;

/** Admin-configured SharePoint read/sync settings (user credentials remain personal). */
export const tenantSharePointActionsSettings = pgTable(
  "TenantSharePointActionsSettings",
  {
    allowRead: boolean("allowRead").notNull().default(true),
    credentialMode: varchar("credentialMode", { length: 16 })
      .notNull()
      .default("managed"),
    oauthClientId: varchar("oauthClientId", { length: 512 }),
    oauthClientSecretEncrypted: text("oauthClientSecretEncrypted"),
    tenantId: uuid("tenantId")
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  }
);

export type TenantSharePointActionsSettings = InferSelectModel<
  typeof tenantSharePointActionsSettings
>;

/** Admin-configured Slack chat actions (user credentials remain personal). */
export const tenantSlackActionsSettings = pgTable(
  "TenantSlackActionsSettings",
  {
    credentialMode: varchar("credentialMode", { length: 16 })
      .notNull()
      .default("managed"),
    oauthClientId: varchar("oauthClientId", { length: 512 }),
    oauthClientSecretEncrypted: text("oauthClientSecretEncrypted"),
    tenantId: uuid("tenantId")
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  }
);

export type TenantSlackActionsSettings = InferSelectModel<
  typeof tenantSlackActionsSettings
>;

/** Admin-configured Slack integration (@mention in channels/DMs). */
export const tenantSlackIntegrationSettings = pgTable(
  "TenantSlackIntegrationSettings",
  {
    allowedChannelIds: jsonb("allowedChannelIds")
      .$type<string[]>()
      .notNull()
      .default([]),
    botTokenEncrypted: text("botTokenEncrypted"),
    botUserId: varchar("botUserId", { length: 128 }),
    credentialMode: varchar("credentialMode", { length: 16 })
      .notNull()
      .default("managed"),
    deliverablesEnabled: boolean("deliverablesEnabled").notNull().default(true),
    dmsEnabled: boolean("dmsEnabled").notNull().default(true),
    enabled: boolean("enabled").notNull().default(false),
    installedAt: timestamp("installedAt"),
    installedByUserId: uuid("installedByUserId").references(() => chatUser.id, {
      onDelete: "set null",
    }),
    oauthClientId: varchar("oauthClientId", { length: 512 }),
    oauthClientSecretEncrypted: text("oauthClientSecretEncrypted"),
    signingSecretEncrypted: text("signingSecretEncrypted"),
    slackTeamId: varchar("slackTeamId", { length: 128 }),
    slackTeamName: varchar("slackTeamName", { length: 256 }),
    tenantId: uuid("tenantId")
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  }
);

export type TenantSlackIntegrationSettings = InferSelectModel<
  typeof tenantSlackIntegrationSettings
>;

/** Maps a Slack thread to a Kimiro chat for conversation continuity. */
export const tenantSlackIntegrationThreads = pgTable(
  "TenantSlackIntegrationThread",
  {
    authUserId: varchar("authUserId", { length: 128 }).notNull(),
    chatId: uuid("chatId").notNull(),
    pendingApprovalMessageTs: varchar("pendingApprovalMessageTs", {
      length: 64,
    }),
    slackChannelId: varchar("slackChannelId", { length: 128 }).notNull(),
    slackThreadTs: varchar("slackThreadTs", { length: 64 }).notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.tenantId, table.slackChannelId, table.slackThreadTs],
    }),
  })
);

export type TenantSlackIntegrationThread = InferSelectModel<
  typeof tenantSlackIntegrationThreads
>;

/** Admin-configured Jira chat actions (user credentials remain personal). */
export const tenantJiraActionsSettings = pgTable("TenantJiraActionsSettings", {
  credentialMode: varchar("credentialMode", { length: 16 })
    .notNull()
    .default("managed"),
  oauthClientId: varchar("oauthClientId", { length: 512 }),
  oauthClientSecretEncrypted: text("oauthClientSecretEncrypted"),
  siteUrl: varchar("siteUrl", { length: 512 }),
  tenantId: uuid("tenantId")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantJiraActionsSettings = InferSelectModel<
  typeof tenantJiraActionsSettings
>;

export const integrationAvailabilityModeEnum = pgEnum(
  "integration_availability_mode",
  ["everyone", "selected"]
);

/** Per-integration workspace availability (admin enables via setup wizard). */
export const tenantIntegrationAvailability = pgTable(
  "TenantIntegrationAvailability",
  {
    availabilityMode: integrationAvailabilityModeEnum("availabilityMode")
      .notNull()
      .default("everyone"),
    integrationKey: varchar("integrationKey", { length: 64 }).notNull(),
    isEnabled: boolean("isEnabled").notNull().default(false),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.integrationKey] }),
  })
);

export type TenantIntegrationAvailability = InferSelectModel<
  typeof tenantIntegrationAvailability
>;

/** Members allowed when availability mode is selected. */
export const tenantIntegrationMembers = pgTable(
  "TenantIntegrationMember",
  {
    integrationKey: varchar("integrationKey", { length: 64 }).notNull(),
    memberId: uuid("memberId")
      .notNull()
      .references(() => tenantMembers.id, { onDelete: "cascade" }),
    tenantId: uuid("tenantId").notNull(),
  },
  (table) => ({
    availabilityFk: foreignKey({
      columns: [table.tenantId, table.integrationKey],
      foreignColumns: [
        tenantIntegrationAvailability.tenantId,
        tenantIntegrationAvailability.integrationKey,
      ],
    }).onDelete("cascade"),
    pk: primaryKey({
      columns: [table.tenantId, table.integrationKey, table.memberId],
    }),
  })
);

export type TenantIntegrationMember = InferSelectModel<
  typeof tenantIntegrationMembers
>;

export const mcpTransportEnum = pgEnum("mcp_transport", [
  "sse",
  "streamable_http",
]);

export const mcpAuthModeEnum = pgEnum("mcp_auth_mode", ["none", "bearer"]);

export const tenantMcpServers = pgTable(
  "TenantMcpServer",
  {
    authMode: mcpAuthModeEnum("authMode").notNull().default("none"),
    authToken: text("authToken"),
    availabilityMode: integrationAvailabilityModeEnum("availabilityMode")
      .notNull()
      .default("everyone"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    description: text("description"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    isEnabled: boolean("isEnabled").notNull().default(false),
    name: varchar("name", { length: 120 }).notNull(),
    serverUrl: varchar("serverUrl", { length: 2048 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    transport: mcpTransportEnum("transport").notNull().default("sse"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantSlugUnique: unique("TenantMcpServer_tenantId_slug_unique").on(
      table.tenantId,
      table.slug
    ),
  })
);

export type TenantMcpServer = InferSelectModel<typeof tenantMcpServers>;

export const tenantMcpServerMembers = pgTable(
  "TenantMcpServerMember",
  {
    memberId: uuid("memberId")
      .notNull()
      .references(() => tenantMembers.id, { onDelete: "cascade" }),
    serverId: uuid("serverId")
      .notNull()
      .references(() => tenantMcpServers.id, { onDelete: "cascade" }),
    tenantId: uuid("tenantId").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.tenantId, table.serverId, table.memberId],
    }),
  })
);

export type TenantMcpServerMember = InferSelectModel<
  typeof tenantMcpServerMembers
>;

export const mcpUserConnections = pgTable(
  "McpUserConnection",
  {
    authUserId: text("authUserId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    connectedAt: timestamp("connectedAt").notNull().defaultNow(),
    serverId: uuid("serverId")
      .notNull()
      .references(() => tenantMcpServers.id, { onDelete: "cascade" }),
    tenantId: uuid("tenantId").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.serverId, table.authUserId] }),
  })
);

export type McpUserConnection = InferSelectModel<typeof mcpUserConnections>;

export const sourceConnectorTypeEnum = pgEnum("source_connector_type", [
  "manual",
  "drive",
  "upload",
  "confluence",
  "notion",
  "sharepoint",
  "slack",
]);
export const sourceVisibilityEnum = pgEnum("source_visibility", [
  "private",
  "shared",
]);
export const sourceAccessPrincipalTypeEnum = pgEnum(
  "source_access_principal_type",
  ["user", "tenant"]
);
export const sourceAccessRoleEnum = pgEnum("source_access_role", [
  "owner",
  "viewer",
]);

export const knowledgeBaseMemberRoleEnum = pgEnum(
  "knowledge_base_member_role",
  ["editor", "viewer"]
);

export const chatKindEnum = pgEnum("chat_kind", [
  "personal",
  "channel",
  "dm",
  "group_dm",
]);

export const chatParticipantRoleEnum = pgEnum("chat_participant_role", [
  "owner",
  "member",
]);

/** User-scoped source items (personal sources). */
export const personalSources = pgTable(
  "PersonalSource",
  {
    authUserId: text("authUserId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    externalRef: varchar("externalRef", { length: 1024 }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    link: varchar("link", { length: 2048 }),
    sourceType: sourceConnectorTypeEnum("sourceType")
      .notNull()
      .default("manual"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantUserIdx: index("PersonalSource_tenant_user_idx").on(
      table.tenantId,
      table.authUserId
    ),
  })
);

export type PersonalSource = InferSelectModel<typeof personalSources>;

/** Tenant-scoped shared source items (team sources). */
export const teamSources = pgTable(
  "TeamSource",
  {
    accessControlList: text("accessControlList").array().notNull().default([]),
    content: text("content").notNull().default(""),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    createdByUserId: text("createdByUserId").references(() => authUser.id, {
      onDelete: "set null",
    }),
    externalRef: varchar("externalRef", { length: 1024 }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    knowledgeBaseId: uuid("knowledgeBaseId").references(
      () => knowledgeBases.id,
      {
        onDelete: "cascade",
      }
    ),
    lastIndexedAt: timestamp("lastIndexedAt"),
    link: varchar("link", { length: 2048 }),
    sourceExternalAccess: jsonb("sourceExternalAccess"),
    sourceType: sourceConnectorTypeEnum("sourceType")
      .notNull()
      .default("manual"),
    sourceUpdatedAt: timestamp("sourceUpdatedAt"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    visibility: sourceVisibilityEnum("visibility").notNull().default("private"),
  },
  (table) => ({
    knowledgeBaseIdx: index("TeamSource_knowledge_base_idx").on(
      table.knowledgeBaseId
    ),
    tenantIdx: index("TeamSource_tenant_idx").on(table.tenantId),
  })
);

export type TeamSource = InferSelectModel<typeof teamSources>;

export const knowledgeBases = pgTable(
  "KnowledgeBase",
  {
    /** FK to Chat.id — enforced in SQL migrations (channel-owned knowledge). */
    channelChatId: uuid("channelChatId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    createdByUserId: text("createdByUserId").notNull(),
    description: text("description"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 512 }).notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    channelChatUnique: unique("KnowledgeBase_channel_chat_unique").on(
      table.channelChatId
    ),
    createdByIdx: index("KnowledgeBase_created_by_idx").on(
      table.createdByUserId
    ),
    tenantIdx: index("KnowledgeBase_tenant_idx").on(table.tenantId),
  })
);

export type KnowledgeBase = InferSelectModel<typeof knowledgeBases>;

export const knowledgeBaseMembers = pgTable(
  "KnowledgeBaseMember",
  {
    addedByUserId: text("addedByUserId").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    knowledgeBaseId: uuid("knowledgeBaseId")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    role: knowledgeBaseMemberRoleEnum("role").notNull().default("viewer"),
    userId: text("userId").notNull(),
  },
  (table) => ({
    knowledgeBaseIdx: index("KnowledgeBaseMember_knowledge_base_idx").on(
      table.knowledgeBaseId
    ),
    knowledgeBaseUserUnique: unique("KnowledgeBaseMember_kb_user_unique").on(
      table.knowledgeBaseId,
      table.userId
    ),
    userIdx: index("KnowledgeBaseMember_user_idx").on(table.userId),
  })
);

export type KnowledgeBaseMember = InferSelectModel<typeof knowledgeBaseMembers>;

export const knowledgeBaseSources = pgTable(
  "KnowledgeBaseSource",
  {
    addedAt: timestamp("addedAt").notNull().defaultNow(),
    addedByUserId: text("addedByUserId").notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    knowledgeBaseId: uuid("knowledgeBaseId")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    sourceItemId: uuid("sourceItemId")
      .notNull()
      .references(() => teamSources.id, { onDelete: "cascade" }),
  },
  (table) => ({
    knowledgeBaseIdx: index("KnowledgeBaseSource_knowledge_base_idx").on(
      table.knowledgeBaseId
    ),
    knowledgeBaseSourceUnique: unique(
      "KnowledgeBaseSource_knowledge_base_source_unique"
    ).on(table.knowledgeBaseId, table.sourceItemId),
    sourceItemIdx: index("KnowledgeBaseSource_source_item_idx").on(
      table.sourceItemId
    ),
  })
);

export type KnowledgeBaseSource = InferSelectModel<typeof knowledgeBaseSources>;

export const sourceChunks = pgTable(
  "SourceChunk",
  {
    accessControlList: text("accessControlList").array().notNull().default([]),
    blurb: text("blurb").notNull().default(""),
    chunkIndex: integer("chunkIndex").notNull(),
    content: text("content").notNull(),
    contentEmbedding: pgVector768("contentEmbedding").notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    knowledgeBaseId: uuid("knowledgeBaseId")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    link: text("link").notNull().default(""),
    sourceConnectorType: varchar("sourceConnectorType", { length: 64 }),
    sourceItemId: uuid("sourceItemId")
      .notNull()
      .references(() => teamSources.id, { onDelete: "cascade" }),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    titleEmbedding: pgVector768("titleEmbedding"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    knowledgeBaseIdx: index("SourceChunk_knowledge_base_idx").on(
      table.knowledgeBaseId
    ),
    knowledgeBaseSourceChunkUnique: unique(
      "SourceChunk_knowledge_base_source_chunk_unique"
    ).on(table.knowledgeBaseId, table.sourceItemId, table.chunkIndex),
    sourceItemIdx: index("SourceChunk_source_item_idx").on(table.sourceItemId),
    tenantIdx: index("SourceChunk_tenant_idx").on(table.tenantId),
  })
);

export type SourceChunk = InferSelectModel<typeof sourceChunks>;

export const sourceAccessGrants = pgTable(
  "SourceAccessGrant",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    grantedByUserId: text("grantedByUserId").references(() => authUser.id, {
      onDelete: "set null",
    }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    principalId: text("principalId"),
    principalType: sourceAccessPrincipalTypeEnum("principalType").notNull(),
    role: sourceAccessRoleEnum("role").notNull().default("viewer"),
    sourceItemId: uuid("sourceItemId")
      .notNull()
      .references(() => teamSources.id, { onDelete: "cascade" }),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    principalIdx: index("SourceAccessGrant_principal_idx").on(
      table.principalType,
      table.principalId
    ),
    sourceItemIdx: index("SourceAccessGrant_item_idx").on(table.sourceItemId),
    tenantIdx: index("SourceAccessGrant_tenant_idx").on(table.tenantId),
  })
);

export type SourceAccessGrant = InferSelectModel<typeof sourceAccessGrants>;

export const credentialTypeEnum = pgEnum("credential_type", [
  "api_key",
  "oauth2",
]);

export const connectorStatusEnum = pgEnum("connector_status", [
  "draft",
  "active",
]);

export const connectorAccessRoleEnum = pgEnum("connector_access_role", [
  "owner",
  "use",
]);

export const credentials = pgTable(
  "Credential",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    enabled: boolean("enabled").notNull().default(true),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    oauthScopes: json("oauthScopes").$type<string[] | null>(),
    /** Null => shared across tenant. Non-null => private to this user only. */
    ownedByUserId: text("ownedByUserId").references(() => authUser.id, {
      onDelete: "cascade",
    }),
    provider: varchar("provider", { length: 64 }),
    secretEncrypted: text("secretEncrypted").notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: credentialTypeEnum("type").notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    ownedByUserIdIdx: index("Credential_ownedByUserId_idx").on(
      table.ownedByUserId
    ),
    tenantIdIdx: index("Credential_tenantId_idx").on(table.tenantId),
  })
);

export type Credential = InferSelectModel<typeof credentials>;

export const connectors = pgTable(
  "Connector",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    createdBy: text("createdBy").references(() => authUser.id, {
      onDelete: "set null",
    }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    /** Null => shared across tenant. Non-null => private to this user only. */
    ownedByUserId: text("ownedByUserId").references(() => authUser.id, {
      onDelete: "cascade",
    }),
    source: varchar("source", { length: 32 }),
    status: connectorStatusEnum("status").notNull().default("draft"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    toolOrder: json("toolOrder").$type<string[] | null>(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    updatedBy: text("updatedBy").references(() => authUser.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    ownedByUserIdIdx: index("Connector_ownedByUserId_idx").on(
      table.ownedByUserId
    ),
    tenantIdIdx: index("Connector_tenantId_idx").on(table.tenantId),
  })
);

export type Connector = InferSelectModel<typeof connectors>;

export const connectorAccess = pgTable(
  "ConnectorAccess",
  {
    connectorId: uuid("connectorId")
      .notNull()
      .references(() => connectors.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    grantedBy: text("grantedBy").references(() => authUser.id, {
      onDelete: "set null",
    }),
    role: connectorAccessRoleEnum("role").notNull().default("use"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    userId: text("userId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.connectorId, table.userId] }),
    userIdIdx: index("ConnectorAccess_userId_idx").on(table.userId),
  })
);

export type ConnectorAccess = InferSelectModel<typeof connectorAccess>;

export const toolConfigs = pgTable(
  "ToolConfig",
  {
    configEncrypted: text("configEncrypted").notNull(),
    connectorId: uuid("connectorId").references(() => connectors.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    credentialId: uuid("credentialId").references(() => credentials.id, {
      onDelete: "set null",
    }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 255 }),
    /** Null => shared across tenant. Non-null => private to this user only. */
    ownedByUserId: text("ownedByUserId").references(() => authUser.id, {
      onDelete: "cascade",
    }),
    providerId: varchar("providerId", { length: 64 }).notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    toolId: varchar("toolId", { length: 128 }).notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    connectorIdIdx: index("ToolConfig_connectorId_idx").on(table.connectorId),
    ownedByUserIdIdx: index("ToolConfig_ownedByUserId_idx").on(
      table.ownedByUserId
    ),
    tenantIdIdx: index("ToolConfig_tenantId_idx").on(table.tenantId),
  })
);

export type ToolConfig = InferSelectModel<typeof toolConfigs>;

export const llmProviderNameEnum = pgEnum("llm_provider_name", [
  "openai",
  "anthropic",
  "google",
]);

/** Tenant-configured LLM provider (encrypted API key, optional custom base URL). */
export const tenantLlmProviders = pgTable(
  "TenantLlmProvider",
  {
    apiBase: varchar("apiBase", { length: 512 }),
    apiKeyEncrypted: text("apiKeyEncrypted"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 255 }),
    provider: llmProviderNameEnum("provider").notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index("TenantLlmProvider_tenantId_idx").on(table.tenantId),
    tenantProviderUnique: unique("TenantLlmProvider_tenant_provider_unique").on(
      table.tenantId,
      table.provider
    ),
  })
);

export type TenantLlmProvider = InferSelectModel<typeof tenantLlmProviders>;

/** Per-provider model visibility and display overrides for a tenant. */
export const tenantLlmModelConfigurations = pgTable(
  "TenantLlmModelConfiguration",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    displayName: varchar("displayName", { length: 255 }),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    isVisible: boolean("isVisible").notNull().default(true),
    llmProviderId: uuid("llmProviderId")
      .notNull()
      .references(() => tenantLlmProviders.id, { onDelete: "cascade" }),
    modelId: varchar("modelId", { length: 128 }).notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    llmProviderIdIdx: index("TenantLlmModelConfiguration_llmProviderId_idx").on(
      table.llmProviderId
    ),
    providerModelUnique: unique(
      "TenantLlmModelConfiguration_provider_model_unique"
    ).on(table.llmProviderId, table.modelId),
  })
);

export type TenantLlmModelConfiguration = InferSelectModel<
  typeof tenantLlmModelConfigurations
>;

/** Tenant defaults for chat and title generation models. */
export const tenantLlmSettings = pgTable("TenantLlmSettings", {
  defaultChatModelId: varchar("defaultChatModelId", { length: 128 }),
  defaultChatReasoningEffort: varchar("defaultChatReasoningEffort", {
    length: 16,
  }),
  defaultTitleModelId: varchar("defaultTitleModelId", { length: 128 }),
  tenantId: uuid("tenantId")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantLlmSettings = InferSelectModel<typeof tenantLlmSettings>;

export const webSearchProviderCategoryEnum = pgEnum(
  "web_search_provider_category",
  ["search", "content"]
);

/** Tenant-configured web search / crawler provider (encrypted API key + config). */
export const tenantWebSearchProviders = pgTable(
  "TenantWebSearchProvider",
  {
    apiKeyEncrypted: text("apiKeyEncrypted"),
    category: webSearchProviderCategoryEnum("category").notNull(),
    config: jsonb("config")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    isActive: boolean("isActive").notNull().default(false),
    providerType: varchar("providerType", { length: 64 }).notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tenantCategoryProviderUnique: unique(
      "TenantWebSearchProvider_tenant_category_provider_unique"
    ).on(table.tenantId, table.category, table.providerType),
    tenantIdIdx: index("TenantWebSearchProvider_tenantId_idx").on(
      table.tenantId
    ),
  })
);

export type TenantWebSearchProvider = InferSelectModel<
  typeof tenantWebSearchProviders
>;

/** Tenant-level web search behavior (auto-read limit, etc.). */
export const tenantWebSearchSettings = pgTable("TenantWebSearchSettings", {
  maxAutoReadPages: integer("maxAutoReadPages").notNull().default(5),
  tenantId: uuid("tenantId")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantWebSearchSettings = InferSelectModel<
  typeof tenantWebSearchSettings
>;

/** Chat-scoped user (distinct from Better Auth `user` table). */
export const chatUser = pgTable("User", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  email: varchar("email", { length: 64 }).notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  image: text("image"),
  name: text("name"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ChatUser = InferSelectModel<typeof chatUser>;

export const chat = pgTable(
  "Chat",
  {
    /** Rolling LLM context summary for long threads (model-only; UI keeps full history). */
    contextSummary: text("contextSummary"),
    contextSummaryThroughMessageId: uuid("contextSummaryThroughMessageId"),
    contextSummaryUpdatedAt: timestamp("contextSummaryUpdatedAt"),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    kind: chatKindEnum("kind").notNull().default("personal"),
    knowledgeBaseId: uuid("knowledgeBaseId").references(
      () => knowledgeBases.id,
      {
        onDelete: "set null",
      }
    ),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Channel-level thread tag catalog (label + color). */
    /** Channel-level thread tag catalog (label + color). */
    threadTagCatalog: jsonb("threadTagCatalog"),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => chatUser.id),
  },
  (table) => ({
    knowledgeBaseIdx: index("Chat_knowledge_base_idx").on(
      table.knowledgeBaseId
    ),
  })
);

export type Chat = InferSelectModel<typeof chat>;

export const chatParticipants = pgTable(
  "ChatParticipant",
  {
    addedByUserId: text("addedByUserId").notNull(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    lastReadAt: timestamp("lastReadAt"),
    role: chatParticipantRoleEnum("role").notNull().default("member"),
    userId: text("userId").notNull(),
  },
  (table) => ({
    chatIdx: index("ChatParticipant_chat_idx").on(table.chatId),
    chatUserUnique: unique("ChatParticipant_chat_user_unique").on(
      table.chatId,
      table.userId
    ),
    userIdx: index("ChatParticipant_user_idx").on(table.userId),
  })
);

export type ChatParticipant = InferSelectModel<typeof chatParticipants>;

export const libraryFiles = pgTable(
  "LibraryFile",
  {
    chatId: uuid("chatId").references(() => chat.id, { onDelete: "set null" }),
    contentType: text("contentType").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    driveFileId: varchar("driveFileId", { length: 128 }),
    driveWebViewLink: text("driveWebViewLink"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    pathname: text("pathname").notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
    source: varchar("source", { length: 32 }).notNull().default("upload"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => chatUser.id),
  },
  (table) => ({
    pathnameUnique: unique("library_file_pathname_unique").on(table.pathname),
    tenantCreatedIdx: index("library_file_tenant_user_created_idx").on(
      table.tenantId,
      table.userId,
      table.createdAt
    ),
  })
);

export type LibraryFile = InferSelectModel<typeof libraryFiles>;

export const message = pgTable(
  "Message_v2",
  {
    attachments: json("attachments").notNull(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    metadata: json("metadata"),
    parts: json("parts").notNull(),
    role: varchar("role").notNull(),
    /** When set, this message is a reply inside the thread rooted at this id. */
    threadRootMessageId: uuid("threadRootMessageId"),
  },
  (table) => ({
    chatThreadRootIdx: index("Message_v2_chat_thread_root_idx").on(
      table.chatId,
      table.threadRootMessageId
    ),
  })
);

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const messageReaction = pgTable(
  "MessageReaction",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    emoji: varchar("emoji", { length: 32 }).notNull(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => chatUser.id, { onDelete: "cascade" }),
  },
  (table) => ({
    chatIdx: index("MessageReaction_chat_idx").on(table.chatId),
    pk: primaryKey({
      columns: [table.messageId, table.userId, table.emoji],
    }),
  })
);

export type MessageReaction = InferSelectModel<typeof messageReaction>;

export const document = pgTable(
  "Document",
  {
    content: text("content"),
    createdAt: timestamp("createdAt").notNull(),
    /** Linked Google Drive file when opened/imported from Drive. */
    driveFileId: varchar("driveFileId", { length: 128 }),
    driveWebViewLink: text("driveWebViewLink"),
    id: uuid("id").notNull().defaultRandom(),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => chatUser.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    createdAt: timestamp("createdAt").notNull(),
    description: text("description"),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    documentId: uuid("documentId").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    isResolved: boolean("isResolved").notNull().default(false),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => chatUser.id),
  },
  (table) => ({
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
  },
  (table) => ({
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
    pk: primaryKey({ columns: [table.id] }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const tenantUsageSettings = pgTable("TenantUsageSettings", {
  /**
   * Default included API spend **per active seat** per billing period (cents).
   * Workspace pool = activeSeats × this value.
   */
  monthlyAllowanceUsdCents: integer("monthlyAllowanceUsdCents")
    .notNull()
    .default(1800),
  tenantId: uuid("tenantId")
    .primaryKey()
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantUsageSettings = InferSelectModel<typeof tenantUsageSettings>;

/** Stripe subscription + prepaid top-up balance for a workspace. */
export const tenantBilling = pgTable("TenantBilling", {
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  /** month | year */
  interval: varchar("interval", { length: 16 }),
  /** @deprecated Use topUpBalanceUsdCents; kept for migration compatibility. */
  onDemandEnabled: boolean("onDemandEnabled").notNull().default(false),
  seatQuantity: integer("seatQuantity").notNull().default(0),
  /** none | trialing | active | past_due | canceled | unpaid | incomplete… */
  status: varchar("status", { length: 32 }).notNull().default("none"),
  stripeCustomerId: text("stripeCustomerId"),
  /** @deprecated Metered on-demand removed; kept for migration compatibility. */
  stripeOnDemandItemId: text("stripeOnDemandItemId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  stripeSubscriptionItemId: text("stripeSubscriptionItemId"),
  tenantId: uuid("tenantId")
    .primaryKey()
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** Prepaid AI credits beyond the included seat pool (cents). */
  topUpBalanceUsdCents: integer("topUpBalanceUsdCents").notNull().default(0),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TenantBilling = InferSelectModel<typeof tenantBilling>;

/** Purchase / debit history for prepaid top-ups. */
export const tenantTopUpLedger = pgTable(
  "TenantTopUpLedger",
  {
    /** Positive for purchase/credit, negative for debit. */
    amountUsdCents: integer("amountUsdCents").notNull(),
    balanceAfterUsdCents: integer("balanceAfterUsdCents").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    /** purchase | debit | adjustment */
    kind: varchar("kind", { length: 32 }).notNull(),
    note: text("note"),
    stripeCheckoutSessionId: text("stripeCheckoutSessionId"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    usageEventId: uuid("usageEventId"),
  },
  (table) => ({
    tenantCreatedIdx: index("tenant_topup_ledger_tenant_created_idx").on(
      table.tenantId,
      table.createdAt
    ),
  })
);

export type TenantTopUpLedger = InferSelectModel<typeof tenantTopUpLedger>;

/** Admin override for a member's monthly quota. Missing row → per-seat default. */
export const tenantMemberUsageQuotas = pgTable(
  "TenantMemberUsageQuota",
  {
    authUserId: text("authUserId")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    monthlyQuotaUsdCents: integer("monthlyQuotaUsdCents").notNull(),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.authUserId] }),
    tenantIdx: index("tenant_member_usage_quota_tenant_idx").on(table.tenantId),
  })
);

export type TenantMemberUsageQuota = InferSelectModel<
  typeof tenantMemberUsageQuotas
>;

export const tenantUsageEvents = pgTable(
  "TenantUsageEvent",
  {
    authUserId: text("authUserId"),
    chatId: uuid("chatId"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    /** Millionths of a USD (1_000_000 = $1). */
    estimatedCostUsdMicros: integer("estimatedCostUsdMicros")
      .notNull()
      .default(0),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    imageGenerationCount: integer("imageGenerationCount").notNull().default(0),
    inputTokens: integer("inputTokens").notNull().default(0),
    modelId: varchar("modelId", { length: 128 }),
    outputTokens: integer("outputTokens").notNull().default(0),
    sandboxExecCount: integer("sandboxExecCount").notNull().default(0),
    sandboxExecDurationMs: integer("sandboxExecDurationMs")
      .notNull()
      .default(0),
    source: varchar("source", { length: 32 }).notNull().default("chat"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    totalTokens: integer("totalTokens").notNull().default(0),
    webSearchCount: integer("webSearchCount").notNull().default(0),
  },
  (table) => ({
    tenantCreatedIdx: index("tenant_usage_event_tenant_created_idx").on(
      table.tenantId,
      table.createdAt
    ),
  })
);

export type TenantUsageEvent = InferSelectModel<typeof tenantUsageEvents>;

/**
 * Tenant-owned authorization boundary for chat turn runs.
 * Every product-facing run operation resolves through this table.
 */
export const chatWorkflowRuns = pgTable(
  "ChatWorkflowRun",
  {
    assistantMessageId: uuid("assistantMessageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    authUserId: text("authUserId").notNull(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    idempotencyKey: text("idempotencyKey").notNull(),
    modelId: varchar("modelId", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    usageEventId: uuid("usageEventId").references(() => tenantUsageEvents.id, {
      onDelete: "set null",
    }),
    userMessageId: uuid("userMessageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    workflowName: varchar("workflowName", { length: 128 })
      .notNull()
      .default("chat-turn"),
    workflowRunId: text("workflowRunId").primaryKey().notNull(),
  },
  (table) => ({
    idempotencyUnique: unique("chat_workflow_run_idempotency_unique").on(
      table.idempotencyKey
    ),
    tenantChatCreatedIdx: index("chat_workflow_run_tenant_chat_created_idx").on(
      table.tenantId,
      table.chatId,
      table.createdAt
    ),
  })
);

export type ChatWorkflowRun = InferSelectModel<typeof chatWorkflowRuns>;

/**
 * Idempotency boundary for mutating workflow tools. Workflow steps are
 * retried, so a repeated tool call must return the stored result instead of
 * applying the external side effect twice.
 */
export const toolExecutionLedger = pgTable(
  "ToolExecutionLedger",
  {
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    error: text("error"),
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    inputHash: text("inputHash"),
    result: jsonb("result"),
    status: varchar("status", { length: 32 }).notNull().default("running"),
    tenantId: uuid("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    toolCallId: text("toolCallId").notNull(),
    toolName: varchar("toolName", { length: 160 }).notNull(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    usageEventId: uuid("usageEventId").references(() => tenantUsageEvents.id, {
      onDelete: "set null",
    }),
    workflowRunId: text("workflowRunId")
      .notNull()
      .references(() => chatWorkflowRuns.workflowRunId, {
        onDelete: "cascade",
      }),
  },
  (table) => ({
    runToolCallUnique: unique("tool_execution_ledger_run_call_unique").on(
      table.workflowRunId,
      table.toolCallId
    ),
    tenantRunIdx: index("tool_execution_ledger_tenant_run_idx").on(
      table.tenantId,
      table.workflowRunId
    ),
  })
);

export type ToolExecutionLedger = InferSelectModel<typeof toolExecutionLedger>;
