/**
 * Structured JSON logger.
 *
 * Outputs one JSON object per line to stdout/stderr.
 * Supports correlation ID propagation and child loggers
 * that inherit base metadata for request-scoped context.
 */

export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}

export interface LogEntry {
	level: string;
	message: string;
	timestamp: string;
	[key: string]: unknown;
}

export interface Logger {
	debug(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
	/** Create a child logger with additional base metadata. */
	child(meta: Record<string, unknown>): Logger;
}

class StructuredLogger implements Logger {
	constructor(private readonly baseMeta: Record<string, unknown> = {}) {}

	debug(message: string, meta?: Record<string, unknown>): void {
		this.write(LogLevel.DEBUG, message, meta);
	}

	info(message: string, meta?: Record<string, unknown>): void {
		this.write(LogLevel.INFO, message, meta);
	}

	warn(message: string, meta?: Record<string, unknown>): void {
		this.write(LogLevel.WARN, message, meta);
	}

	error(message: string, meta?: Record<string, unknown>): void {
		this.write(LogLevel.ERROR, message, meta);
	}

	child(meta: Record<string, unknown>): Logger {
		return new StructuredLogger({ ...this.baseMeta, ...meta });
	}

	private write(
		level: LogLevel,
		message: string,
		meta?: Record<string, unknown>,
	): void {
		const entry: LogEntry = {
			level,
			timestamp: new Date().toISOString(),
			message,
			...this.baseMeta,
			...meta,
		};
		const line = JSON.stringify(entry);
		if (level === LogLevel.ERROR) {
			console.error(line);
		} else if (level === LogLevel.WARN) {
			console.warn(line);
		} else {
			console.log(line);
		}
	}
}

/**
 * Create a new structured logger with optional base metadata.
 *
 * ```ts
 * const logger = createLogger({ service: "headless-dms" });
 * const reqLogger = logger.child({ correlationId: "abc-123" });
 * reqLogger.info("Request received", { method: "POST", path: "/rpc" });
 * ```
 */
export function createLogger(baseMeta: Record<string, unknown> = {}): Logger {
	return new StructuredLogger(baseMeta);
}
