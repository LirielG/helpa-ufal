import type {
  EnrollmentListResponse,
  EnrollmentResponse,
} from "@/types/enrollment.js";

export interface IEnrollmentService {
  enroll(userId: string, activityId: string): Promise<EnrollmentResponse>;
  cancel(userId: string, activityId: string): Promise<void>;
  listActiveByUser(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<EnrollmentListResponse>;
}
