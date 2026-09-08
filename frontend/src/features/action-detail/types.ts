import type {
  Action,
  ActionDetails as ActionListDetails,
} from "../dashboard/types";

export interface ActionAddress {
  id: string;
  addressLine: string;
  district: string;
  zipCode: string;
  city: string;
  state: string;
}

export interface ActionDetails extends ActionListDetails {
  address: ActionAddress | null;
}

export interface ActionDetail extends Action {
  details: ActionDetails | null;
}
