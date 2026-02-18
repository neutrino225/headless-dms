import { Option, Result } from '@carbonteq/fp';

import { BaseEntity } from './base.entity';

/**
 * Base repository interface - Lives in DOMAIN layer
 * This is a PORT in hexagonal architecture
 *
 * Use Option<T> for "not found" cases, Result<T, E> for errors
 *
 * Note: Infrastructure-specific query options (includes, ordering, etc.)
 * should be defined in the infrastructure layer, not here.
 */
export interface IBaseRepository<T extends BaseEntity> {
  /**
   * Find entity by ID
   * Returns Option<T> - None if not found, Some<T> if found
   */
  findById(id: string): Promise<Result<Option<T>, Error>>;

  /**
   * Find one entity by criteria
   * Returns Option<T> - None if not found, Some<T> if found
   */
  findOne(criteria: Record<string, unknown>): Promise<Result<Option<T>, Error>>;

  /**
   * Find many entities by criteria
   * Returns empty array if none found
   */
  findMany(criteria?: Record<string, unknown>): Promise<Result<T[], Error>>;

  /**
   * Count entities matching criteria
   */
  count(criteria?: Record<string, unknown>): Promise<Result<number, Error>>;

  /**
   * Check if entity exists by ID
   */
  exists(id: string): Promise<Result<boolean, Error>>;

  /**
   * Save entity (create or update)
   * Returns the saved entity
   */
  save(entity: T): Promise<Result<T, Error>>;

  /**
   * Save multiple entities
   * Returns the saved entities
   */
  saveMany(entities: T[]): Promise<Result<T[], Error>>;

  /**
   * Delete entity by ID
   */
  delete(id: string): Promise<Result<void, Error>>;

  /**
   * Update entity by ID with partial data
   */
  update(
    id: string,
    updates: Record<string, unknown>
  ): Promise<Result<T, Error>>;
}

/**
 * Paginated result with metadata
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Extended repository interface with pagination
 */
export interface IPaginatedRepository<T extends BaseEntity>
  extends IBaseRepository<T> {
  findPaginated(
    criteria: Record<string, unknown> & { page: number; pageSize: number }
  ): Promise<Result<PaginatedResult<T>, Error>>;
}

/**
 * Repository with soft delete support
 */
export interface ISoftDeleteRepository<T extends BaseEntity>
  extends IBaseRepository<T> {
  restore(id: string): Promise<Result<T, Error>>;
}

/**
 * Include option for query builders
 *
 * Allows specifying related entities to load with filtering, ordering, etc.
 * This is an infrastructure-agnostic interface that can be mapped to any ORM.
 *
 * Note: This lives in domain/shared because it's used by the query builder
 * interface, which is part of the persistence abstraction layer.
 */
export interface IncludeOption {
  /**
   * Model name to include (e.g., 'DashboardCampaignInfo')
   */
  model: string;

  /**
   * Relation alias (e.g., 'dashboardInfo')
   */
  relation: string;

  /**
   * Optional where clause to filter the included relation
   */
  where?: Record<string, unknown>;

  /**
   * Whether the relation is required (INNER JOIN) or optional (LEFT JOIN)
   * Default: false (LEFT JOIN)
   */
  required?: boolean;

  /**
   * Specific attributes to select from the relation
   */
  attributes?: string[];

  /**
   * Ordering for the included relation
   */
  order?: Array<[string, 'ASC' | 'DESC']>;

  /**
   * Whether this is a one-to-many relation
   * Used internally for query optimization
   */
  many?: boolean;
}
