DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_status') THEN
    ALTER TYPE "connection_status" RENAME TO "connector_status";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_access_role') THEN
    ALTER TYPE "connection_access_role" RENAME TO "connector_access_role";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('"Connection"') IS NOT NULL THEN
    ALTER TABLE "Connection" RENAME TO "Connector";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('"ConnectionAccess"') IS NOT NULL THEN
    ALTER TABLE "ConnectionAccess" RENAME TO "ConnectorAccess";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ConnectorAccess' AND column_name = 'connectionId'
  ) THEN
    ALTER TABLE "ConnectorAccess" RENAME COLUMN "connectionId" TO "connectorId";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ToolConfig' AND column_name = 'connectionId'
  ) THEN
    ALTER TABLE "ToolConfig" RENAME COLUMN "connectionId" TO "connectorId";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('"Connection_tenantId_idx"') IS NOT NULL THEN
    ALTER INDEX "Connection_tenantId_idx" RENAME TO "Connector_tenantId_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('"Connection_ownedByUserId_idx"') IS NOT NULL THEN
    ALTER INDEX "Connection_ownedByUserId_idx" RENAME TO "Connector_ownedByUserId_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('"ConnectionAccess_userId_idx"') IS NOT NULL THEN
    ALTER INDEX "ConnectionAccess_userId_idx" RENAME TO "ConnectorAccess_userId_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('"ToolConfig_connectionId_idx"') IS NOT NULL THEN
    ALTER INDEX "ToolConfig_connectionId_idx" RENAME TO "ToolConfig_connectorId_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Connection_tenantId_Tenant_id_fk'
  ) THEN
    ALTER TABLE "Connector" RENAME CONSTRAINT "Connection_tenantId_Tenant_id_fk" TO "Connector_tenantId_Tenant_id_fk";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Connection_ownedByUserId_user_id_fk'
  ) THEN
    ALTER TABLE "Connector" RENAME CONSTRAINT "Connection_ownedByUserId_user_id_fk" TO "Connector_ownedByUserId_user_id_fk";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Connection_createdBy_user_id_fk'
  ) THEN
    ALTER TABLE "Connector" RENAME CONSTRAINT "Connection_createdBy_user_id_fk" TO "Connector_createdBy_user_id_fk";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Connection_updatedBy_user_id_fk'
  ) THEN
    ALTER TABLE "Connector" RENAME CONSTRAINT "Connection_updatedBy_user_id_fk" TO "Connector_updatedBy_user_id_fk";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConnectionAccess_pkey'
  ) THEN
    ALTER TABLE "ConnectorAccess" RENAME CONSTRAINT "ConnectionAccess_pkey" TO "ConnectorAccess_pkey";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConnectionAccess_connectionId_Connection_id_fk'
  ) THEN
    ALTER TABLE "ConnectorAccess" RENAME CONSTRAINT "ConnectionAccess_connectionId_Connection_id_fk" TO "ConnectorAccess_connectorId_Connector_id_fk";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConnectionAccess_userId_user_id_fk'
  ) THEN
    ALTER TABLE "ConnectorAccess" RENAME CONSTRAINT "ConnectionAccess_userId_user_id_fk" TO "ConnectorAccess_userId_user_id_fk";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConnectionAccess_grantedBy_user_id_fk'
  ) THEN
    ALTER TABLE "ConnectorAccess" RENAME CONSTRAINT "ConnectionAccess_grantedBy_user_id_fk" TO "ConnectorAccess_grantedBy_user_id_fk";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ToolConfig_connectionId_Connection_id_fk'
  ) THEN
    ALTER TABLE "ToolConfig" RENAME CONSTRAINT "ToolConfig_connectionId_Connection_id_fk" TO "ToolConfig_connectorId_Connector_id_fk";
  END IF;
END $$;
