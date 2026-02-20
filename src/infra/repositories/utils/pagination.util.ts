import { count, SQL } from "drizzle-orm";
import { Result } from "@carbonteq/fp";
import { Paginated, PaginationOptions } from "@domain/shared/pagination";
import { PgTableWithColumns } from "drizzle-orm/pg-core";

/**
 * Shared Drizzle-specific pagination utility for repositories.
 * 
 * @param db - Drizzle DB instance
 * @param table - The Drizzle table to query
 * @param options - Pagination options (pageNum, pageSize, offset)
 * @param toDomain - Mapper function from database row to domain entity
 * @param whereClause - Optional Drizzle where clause
 * @param orderBy - Optional Drizzle order by clause
 * @returns A Result containing Paginated data or an Error
 */
export async function fetchPaginated<TTable extends PgTableWithColumns<any>, TDomain>(
  db: any,
  table: TTable,
  options: PaginationOptions,
  toDomain: (raw: any) => TDomain,
  whereClause?: SQL | undefined,
  orderBy?: SQL | SQL[] | undefined
): Promise<Result<Paginated<TDomain>, Error>> {
  try {
    const { pageSize, offset, pageNum } = options;

    // Get total count
    const [countRow] = await db
      .select({ total: count() })
      .from(table)
      .where(whereClause);

    const totalItems = Number(countRow.total);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Get data
    let query = db
      .select()
      .from(table)
      .where(whereClause);
    
    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    const rawRows = await query
      .limit(pageSize)
      .offset(offset - pageSize);

    const items = rawRows.map(toDomain);

    return Result.Ok({
      data: items,
      pageNum,
      pageSize,
      totalPages,
    });
  } catch (error) {
    return Result.Err(error as Error);
  }
}
