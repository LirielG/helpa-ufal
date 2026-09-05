export interface Action {
  details: any;
  id: string;
  authorId: string;
  title: string;
  type: string;
  campus: string;
  startDate: string;
  endDate: string;
  slots: number;
  availableSlots: number;
  status: string;
}

export interface FilterOptions {
  area: string;
  actionType: string;
  availability: string;
  search?: string;
}

export interface PaginatedResponse<T> {
  activities: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}