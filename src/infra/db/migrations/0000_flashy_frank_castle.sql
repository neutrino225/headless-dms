CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
CREATE TYPE "public"."accessLevel" AS ENUM('READ', 'WRITE', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('DOCUMENT_CREATED', 'DOCUMENT_UPDATED', 'DOCUMENT_ARCHIVED', 'DOCUMENT_RESTORED', 'DOCUMENT_DELETED', 'VERSION_UPLOADED', 'VERSION_DELETED', 'DOWNLOAD_LINK_GENERATED', 'DOCUMENT_DOWNLOADED', 'ACCESS_GRANTED', 'ACCESS_REVOKED', 'ACCESS_UPDATED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"isArchived" boolean DEFAULT false NOT NULL,
	"ownerId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"documentId" uuid NOT NULL,
	"versionNumber" integer NOT NULL,
	"storageKey" text NOT NULL,
	"mimeType" text NOT NULL,
	"fileSize" bigint NOT NULL,
	"checksum" text NOT NULL,
	"createdBy" uuid NOT NULL,
	CONSTRAINT "uq_doc_version" UNIQUE("documentId","versionNumber"),
	CONSTRAINT "chk_version_positive" CHECK ("document_versions"."versionNumber" >= 1)
);
--> statement-breakpoint
CREATE TABLE "document_metadata" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"documentId" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "uq_doc_metadata_key" UNIQUE("documentId","key")
);
--> statement-breakpoint
CREATE TABLE "access_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"documentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"accessLevel" "accessLevel" NOT NULL,
	CONSTRAINT "uq_access_policy" UNIQUE("documentId","userId")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"resourceId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_documents_owner_id" ON "documents" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "idx_doc_versions_document_id" ON "document_versions" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "idx_access_policies_user_id" ON "access_policies" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_access_policies_document_id" ON "access_policies" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource_id" ON "audit_logs" USING btree ("resourceId");