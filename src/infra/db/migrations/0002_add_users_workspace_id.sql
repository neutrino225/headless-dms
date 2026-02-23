ALTER TABLE "users" ADD COLUMN "workspaceId" uuid;--> statement-breakpoint
UPDATE "users" SET "workspaceId" = '90000000-0000-0000-0000-000000000001' WHERE "workspaceId" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "workspaceId" SET NOT NULL;
