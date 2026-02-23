import {
	type ObjectStoragePort,
	type PresignedUploadRequest,
	type PresignedUploadResult,
} from "@application/services/object-storage.port";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface MinioStorageConfig {
	readonly endpoint: string;
	readonly accessKeyId: string;
	readonly secretAccessKey: string;
	readonly bucket: string;
	readonly region: string;
	readonly presignExpiresSec: number;
	readonly forcePathStyle: boolean;
}

export class MinioObjectStorageService implements ObjectStoragePort {
	private readonly client: S3Client;

	constructor(private readonly config: MinioStorageConfig) {
		this.client = new S3Client({
			region: config.region,
			endpoint: config.endpoint,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			forcePathStyle: config.forcePathStyle,
		});
	}

	async createPresignedUpload(
		request: PresignedUploadRequest,
	): Promise<PresignedUploadResult> {
		const objectKey = this.buildObjectKey(request);
		const command = new PutObjectCommand({
			Bucket: this.config.bucket,
			Key: objectKey,
			ContentType: request.mimeType,
			ContentLength: request.sizeBytes,
		});

		const uploadUrl = await getSignedUrl(this.client, command, {
			expiresIn: this.config.presignExpiresSec,
		});

		return {
			objectKey,
			uploadUrl,
			expiresAt: new Date(Date.now() + this.config.presignExpiresSec * 1000),
		};
	}

	private buildObjectKey(request: PresignedUploadRequest): string {
		const extension = this.extensionFromMimeType(request.mimeType);
		return `${request.workspaceId}/${request.documentId}/${crypto.randomUUID()}.${extension}`;
	}

	private extensionFromMimeType(mimeType: string): string {
		switch (mimeType) {
			case "application/pdf":
				return "pdf";
			case "image/png":
				return "png";
			case "image/jpeg":
				return "jpg";
			case "text/plain":
				return "txt";
			default:
				return "bin";
		}
	}
}
