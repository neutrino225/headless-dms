/**
 * Application configuration from environment variables.
 * Validates required env vars at startup to fail fast.
 */

export interface AppConfig {
	readonly port: number;
	readonly databaseUrl: string;
	readonly jwtSecret: string;
	readonly corsOrigin: string;
	readonly objectStorage: {
		readonly endpoint: string;
		readonly accessKeyId: string;
		readonly secretAccessKey: string;
		readonly bucket: string;
		readonly region: string;
		readonly presignExpiresSec: number;
		readonly forcePathStyle: boolean;
	};
}

function requiredEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

export function loadConfig(): AppConfig {
	return {
		port: Number(process.env.PORT ?? 3000),
		databaseUrl: requiredEnv("DATABASE_URL"),
		jwtSecret: requiredEnv("JWT_SECRET"),
		corsOrigin: process.env.CORS_ORIGIN ?? "*",
		objectStorage: {
			endpoint: requiredEnv("OBJECT_STORAGE_ENDPOINT"),
			accessKeyId: requiredEnv("OBJECT_STORAGE_ACCESS_KEY"),
			secretAccessKey: requiredEnv("OBJECT_STORAGE_SECRET_KEY"),
			bucket: requiredEnv("OBJECT_STORAGE_BUCKET"),
			region: process.env.OBJECT_STORAGE_REGION ?? "us-east-1",
			presignExpiresSec: Number(
				process.env.OBJECT_STORAGE_PRESIGN_EXPIRES_SEC ?? 3600,
			),
			forcePathStyle:
				(process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
		},
	};
}
