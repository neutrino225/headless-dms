CREATE TYPE "public"."document_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."audit_resource_type" AS ENUM('document', 'user', 'policy');--> statement-breakpoint
ALTER TABLE "document_metadata" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "document_metadata" CASCADE;--> statement-breakpoint
ALTER TABLE "document_versions" RENAME COLUMN "fileSize" TO "sizeBytes";--> statement-breakpoint
ALTER TABLE "document_versions" RENAME COLUMN "createdBy" TO "uploadedBy";--> statement-breakpoint
ALTER TABLE "document_versions" DROP CONSTRAINT "document_versions_createdBy_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "displayName" varchar(150);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "isActive" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- Add slug as nullable, backfill existing rows with a derived default, then tighten to NOT NULL
ALTER TABLE "documents" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "documents" SET "slug" = LOWER(REGEXP_REPLACE(REPLACE(name, ' ', '-'), '[^a-z0-9\-]', '', 'g')) || '-' || SUBSTRING(CAST(id AS text), 1, 8) WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint

-- Add mimeType as nullable, backfill existing rows with a sensible default, then tighten
ALTER TABLE "documents" ADD COLUMN "mimeType" text;--> statement-breakpoint
UPDATE "documents" SET "mimeType" = 'application/octet-stream' WHERE "mimeType" IS NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "mimeType" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "documents" ADD COLUMN "status" "document_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "latestVersionId" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "metadata" jsonb;--> statement-breakpoint

-- Add resourceType as nullable, backfill existing audit rows as 'document', then tighten
ALTER TABLE "audit_logs" ADD COLUMN "resourceType" "audit_resource_type";--> statement-breakpoint
UPDATE "audit_logs" SET "resourceType" = 'document' WHERE "resourceType" IS NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "resourceType" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "audit_logs" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploadedBy_users_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_documents_slug" ON "documents" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "isArchived";