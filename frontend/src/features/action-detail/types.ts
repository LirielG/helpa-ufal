export interface ActionAddress {
  id: string;
  addressLine: string;
  district: string;
  zipCode: string;
  city: string;
  state: string;
}

export interface ActionDetails {
  description: string;
  area: string;
  format: string;
  url?: string;
  workloadHours: number;
  address?: ActionAddress;
}

export interface ActionDetail {
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
  details: ActionDetails;
}
