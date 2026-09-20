import type {
  EnrollmentListResponse,
  EnrollmentResponse,
  ParticipantsListResponse,
} from "@/types/enrollment.js";

export interface IEnrollmentService {
  enroll(userId: string, activityId: string): Promise<EnrollmentResponse>;
  cancel(userId: string, activityId: string): Promise<void>;
  listActiveByUser(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<EnrollmentListResponse>;
  listParticipants(
    userId: string,
    activityId: string,
    page?: number,
    limit?: number,
  ): Promise<ParticipantsListResponse>;
}
