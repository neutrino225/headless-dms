import { Result } from "@carbonteq/fp";
import { DateTime } from "@domain/utils/value-objects";
import {
	BaseEntity,
	type CreateEntity,
	type IEntity,
	type Serialized,
} from "src/domain/shared/base.entity";
import { UUID } from "src/domain/utils/refined-types";
import type { AuditAction } from "./audit-log.enums";

/** The type of resource the audit action was performed on. */
export type AuditResourceType = "document" | "user" | "policy";

export interface IAuditLog extends IEntity {
	readonly userId: UUID;
	readonly action: AuditAction | string;
	readonly resourceId: UUID;
	readonly resourceType: AuditResourceType;
	readonly metadata: Record<string, unknown> | null;
	readonly createdAt: DateTime;
}

export type SerializedAuditLog = Omit<Serialized<IAuditLog>, "createdAt"> & {
	createdAt: string;
};

export class AuditLog extends BaseEntity implements IAuditLog {
	readonly userId: UUID;
	readonly action: AuditAction | string;
	readonly resourceId: UUID;
	readonly resourceType: AuditResourceType;
	readonly metadata: Record<string, unknown> | null;

	private constructor(data: IAuditLog) {
		super(data);
		this.userId = data.userId;
		this.action = data.action;
		this.resourceId = data.resourceId;
		this.resourceType = data.resourceType;
		this.metadata = data.metadata;
	}

	static create(data: CreateEntity<IAuditLog>): Result<AuditLog, Error> {
		return Result.Ok(
			new AuditLog({
				...data,
				id: UUID.init(),
				createdAt: DateTime.now(),
				updatedAt: DateTime.now(),
			}),
		);
	}

	static fromSerialized(raw: SerializedAuditLog): AuditLog {
		return new AuditLog({
			id: UUID.fromTrusted(raw.id),
			userId: UUID.fromTrusted(raw.userId),
			action: raw.action,
			resourceId: UUID.fromTrusted(raw.resourceId),
			resourceType: raw.resourceType as AuditResourceType,
			metadata: raw.metadata ?? null,
			createdAt: DateTime.from(raw.createdAt),
			updatedAt: DateTime.from(raw.updatedAt),
		});
	}

	serialize(): SerializedAuditLog {
		return {
			...this._serialize(),
			userId: UUID.toString(this.userId),
			action: this.action,
			resourceId: UUID.toString(this.resourceId),
			resourceType: this.resourceType,
			metadata: this.metadata,
		};
	}
}
