/**
 * Pagination utility for consistent pagination across all endpoints
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    recordsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Parse pagination parameters from request query
 * @param query - Request query object
 * @param defaultLimit - Default records per page (default: 10)
 * @param maxLimit - Maximum allowed records per page (default: 100)
 * @returns Parsed pagination parameters
 */
export function parsePaginationParams(
  query: { page?: string | number; limit?: string | number },
  defaultLimit: number = 10,
  maxLimit: number = 100
): PaginationParams {
  let page = parseInt(query.page as string) || 1;
  let limit = parseInt(query.limit as string) || defaultLimit;

  // Ensure minimum values
  page = Math.max(1, page);
  limit = Math.max(1, limit);

  // Enforce maximum limit
  limit = Math.min(limit, maxLimit);

  return { page, limit };
}

/**
 * Calculate skip value for database queries
 * @param page - Current page number
 * @param limit - Records per page
 * @returns Skip value for query
 */
export function calculateSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Create pagination metadata
 * @param total - Total number of records
 * @param page - Current page
 * @param limit - Records per page
 * @returns Pagination metadata object
 */
export function createPaginationMetadata(
  total: number,
  page: number,
  limit: number
): PaginationResult<any>['pagination'] {
  const totalPages = Math.ceil(total / limit);
  
  return {
    currentPage: page,
    totalPages,
    totalRecords: total,
    recordsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Create paginated response
 * @param data - Array of data items
 * @param total - Total number of records
 * @param page - Current page
 * @param limit - Records per page
 * @returns Paginated response object
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  return {
    data,
    pagination: createPaginationMetadata(total, page, limit),
  };
}
