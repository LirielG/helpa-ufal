import { ActivityDetails } from "@prisma/client";

export type ActivityType = "EXTENSION" | "COURSE" | "EVENT" | "LECTURE" | "OTHER";

export type CampusLocation = "MACEIO" | "ARAPIRACA" | "PALMEIRA" | "PENEDO" | "RIO_LARGO" | "DELMIRO_GOUVEIA" | "SANTANA_IPANEMA";

export type ActivityStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type ActivityFormat = "IN_PERSON" | "ONLINE" | "HYBRID";

export type ActivityResponse = {
  "id":         string,
  "authorId":   string,
  "title":      string,
  "type":       ActivityType,
  "campus":     CampusLocation,
  "startDate":  Date,
  "endDate":    Date,
  "slots":      number,
  availableSlots: number;
  "status":     ActivityStatus
}

export type AddressResponse = {
  id:           string;
  addressLine:  string;
  district:     string;
  zipCode:      string;
  city:         string;
  state:        string;
};

export type ActivityDetailsResponse = {
  description:   string;
  area:          string;
  format:        ActivityFormat;
  url:           string | null;
  workloadHours: number;
  address:       AddressResponse | null;
};

export type ActivityFullResponse = ActivityResponse & {
  details: ActivityDetailsResponse | null;
};

export type ActivitySource = "LOCAL" | "SIGAA";

export type FeedItemResponse = {
  id: string;
  source: ActivitySource;
  title: string;
  type: ActivityType;
  authorId?: string;
  campus?: CampusLocation;
  startDate?: Date;
  endDate?: Date;
  slots?: number;
  availableSlots?: number;
  status?: ActivityStatus;
  url?: string;
  department?: string;
  originalType?: string;
};

export interface IFeedFilters {
  type?: string;
  search?: string;
  campus?: string;
  source?: "LOCAL" | "SIGAA" | "ALL";
  status?: string;
  format?: string;
  orderBy?: string;
  order?: string;
  page?: string;
  limit?: string;
}

export interface IFeedResponse {
  items: FeedItemResponse[];
  total: number;
  page: number;
  limit: number;
}