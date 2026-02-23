export interface PresignedUploadRequest {
	readonly workspaceId: string;
	readonly documentId: string;
	readonly mimeType: string;
	readonly sizeBytes: number;
}

export interface PresignedUploadResult {
	readonly objectKey: string;
	readonly uploadUrl: string;
	readonly expiresAt: Date;
}

export interface ObjectStoragePort {
	createPresignedUpload(
		request: PresignedUploadRequest,
	): Promise<PresignedUploadResult>;
}
