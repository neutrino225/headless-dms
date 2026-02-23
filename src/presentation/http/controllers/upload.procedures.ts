/**
 * oRPC procedures for document upload / versioning.
 */

import {
	type ConfirmUploadDTO,
	ConfirmUploadDTOSchema,
	type InitiateUploadDTO,
	InitiateUploadDTOSchema,
	type ListDocumentVersionsDTO,
	ListDocumentVersionsDTOSchema,
} from "@application/dto/document/document.dto";
import type { CallerContext } from "@application/workflow/caller-context";
import type { UploadWorkflows } from "@application/workflow/documents/upload.workflow";
import { Schema as S } from "effect";
import type { AuthContext } from "../middleware/context";
import { runEffect } from "./effect-runner";
import {
	toDocumentVersionResponse,
	toUploadInitiationResponse,
} from "./response-mappers";
import { toStandard } from "./schema-adapter";
import type { ProcedureBuilderWithMiddleware } from "./types";

function callerFrom(ctx: AuthContext): CallerContext {
	return {
		userId: ctx.user.sub,
		role: ctx.user.role,
		workspaceId: ctx.user.workspaceId,
	};
}

export function createUploadProcedures(
	authBase: ProcedureBuilderWithMiddleware,
	workflows: UploadWorkflows,
) {
	const initiateUpload = authBase
		.input(toStandard(InitiateUploadDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: InitiateUploadDTO;
				context: AuthContext;
			}) => {
				const result = await runEffect(
					workflows.initiateUpload(input, callerFrom(context)),
				);
				return toUploadInitiationResponse(result);
			},
		);

	const confirmUpload = authBase
		.input(toStandard(ConfirmUploadDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: ConfirmUploadDTO;
				context: AuthContext;
			}) => {
				const version = await runEffect(
					workflows.confirmUpload(input, callerFrom(context)),
				);
				return toDocumentVersionResponse(version);
			},
		);

	const listVersions = authBase
		.input(toStandard(ListDocumentVersionsDTOSchema))
		.handler(async ({ input }: { input: ListDocumentVersionsDTO }) => {
			const result = await runEffect(workflows.listVersions(input));
			return {
				data: result.data.map(toDocumentVersionResponse),
				pageNum: result.pageNum,
				pageSize: result.pageSize,
				totalPages: result.totalPages,
			};
		});

	const getLatestVersion = authBase
		.input(toStandard(S.Struct({ documentId: S.String })))
		.handler(async ({ input }: { input: { documentId: string } }) => {
			const version = await runEffect(
				workflows.getLatestVersion(input.documentId),
			);
			return toDocumentVersionResponse(version);
		});

	const deleteVersion = authBase
		.input(toStandard(S.Struct({ versionId: S.String })))
		.handler(
			async ({
				input,
				context,
			}: {
				input: { versionId: string };
				context: AuthContext;
			}) => {
				const version = await runEffect(
					workflows.deleteVersion(input.versionId, callerFrom(context)),
				);
				return toDocumentVersionResponse(version);
			},
		);

	return {
		initiate: initiateUpload,
		confirm: confirmUpload,
		listVersions,
		getLatest: getLatestVersion,
		delete: deleteVersion,
	};
}
