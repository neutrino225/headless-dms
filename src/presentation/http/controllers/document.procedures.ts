import {
	type ChangeDocumentStatusDTO,
	ChangeDocumentStatusDTOSchema,
	type CreateDocumentDTO,
	CreateDocumentDTOSchema,
	type DeleteDocumentDTO,
	DeleteDocumentDTOSchema,
	type GetDocumentByIdDTO,
	GetDocumentByIdDTOSchema,
	type GetDocumentBySlugDTO,
	GetDocumentBySlugDTOSchema,
	type ListDocumentsDTO,
	ListDocumentsDTOSchema,
	type UpdateDocumentDTO,
	UpdateDocumentDTOSchema,
} from "@application/dto/document/document.dto";
import type { CallerContext } from "@application/workflow/caller-context";
import type { DocumentWorkflows } from "@application/workflow/documents/document.workflow";
import type { AuthContext } from "../middleware/context";
import { runEffect } from "./effect-runner";
import {
	toDocumentResponse,
	toPaginatedDocumentsResponse,
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

export function createDocumentProcedures(
	authBase: ProcedureBuilderWithMiddleware,
	workflows: DocumentWorkflows,
) {
	const createDocument = authBase
		.input(toStandard(CreateDocumentDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: CreateDocumentDTO;
				context: AuthContext;
			}) => {
				const doc = await runEffect(
					workflows.createDocument(input, callerFrom(context)),
				);
				return toDocumentResponse(doc);
			},
		);

	const updateDocument = authBase
		.input(toStandard(UpdateDocumentDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: UpdateDocumentDTO;
				context: AuthContext;
			}) => {
				const doc = await runEffect(
					workflows.updateDocument(input, callerFrom(context)),
				);
				return toDocumentResponse(doc);
			},
		);

	const deleteDocument = authBase
		.input(toStandard(DeleteDocumentDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: DeleteDocumentDTO;
				context: AuthContext;
			}) => {
				const doc = await runEffect(
					workflows.deleteDocument(input, callerFrom(context)),
				);
				return toDocumentResponse(doc);
			},
		);

	const changeStatus = authBase
		.input(toStandard(ChangeDocumentStatusDTOSchema))
		.handler(
			async ({
				input,
				context,
			}: {
				input: ChangeDocumentStatusDTO;
				context: AuthContext;
			}) => {
				const doc = await runEffect(
					workflows.changeDocumentStatus(input, callerFrom(context)),
				);
				return toDocumentResponse(doc);
			},
		);

	const getById = authBase
		.input(toStandard(GetDocumentByIdDTOSchema))
		.handler(async ({ input }: { input: GetDocumentByIdDTO }) => {
			const doc = await runEffect(workflows.getDocumentById(input.id));
			return toDocumentResponse(doc);
		});

	const getBySlug = authBase
		.input(toStandard(GetDocumentBySlugDTOSchema))
		.handler(async ({ input }: { input: GetDocumentBySlugDTO }) => {
			const doc = await runEffect(workflows.getDocumentBySlug(input.slug));
			return toDocumentResponse(doc);
		});

	const list = authBase
		.input(toStandard(ListDocumentsDTOSchema))
		.handler(async ({ input }: { input: ListDocumentsDTO }) => {
			const result = await runEffect(workflows.listDocuments(input));
			return toPaginatedDocumentsResponse(result);
		});

	return {
		create: createDocument,
		update: updateDocument,
		delete: deleteDocument,
		changeStatus,
		getById,
		getBySlug,
		list,
	};
}
