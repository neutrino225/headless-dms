import type { UUID } from "../utils/refined-types/uuid.type.js";
import { BaseEntity } from "./base.entity.js";

export abstract class AggregateRoot<
	TId extends string = UUID,
> extends BaseEntity<TId> {}
