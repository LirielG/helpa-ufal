export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type Paginated<T> = PaginatedList<T> & {
  totalPages: number;
};

export function toPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
