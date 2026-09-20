import type {
  ActionCampus,
  ActionFormat,
  ActionType,
} from "../dashboard/types";

/**
 * The API has no partial address: `AddressSchema` requires the five fields in
 * every address object, so a change to one of them sends the whole block.
 */
export interface ActionAddressPayload {
  addressLine: string;
  district: string;
  zipCode: string;
  city: string;
  state: string;
}

/** Body of `PATCH /activities/:id`: only the fields the user changed. */
export interface UpdateActionPayload {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  type?: ActionType;
  campus?: ActionCampus;
  format?: ActionFormat;
  area?: string;
  slots?: number;
  workloadHours?: number;
  url?: string;
  address?: ActionAddressPayload;
}
