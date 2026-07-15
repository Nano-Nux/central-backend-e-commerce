export type PaginationInput = {
  page?: number | string;
  limit?: number | string;
};

export type PaginationResult = {
  page: number;
  limit: number;
  offset: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function getSafePagination(
  input: PaginationInput = {},
): PaginationResult {
  const page = Math.max(Number(input.page) || DEFAULT_PAGE, DEFAULT_PAGE);
  const rawLimit = Math.max(Number(input.limit) || DEFAULT_LIMIT, 1);
  const limit = Math.min(rawLimit, MAX_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export function getTotalPages(total: number, limit: number) {
  return Math.ceil(total / Math.max(limit, 1));
}
