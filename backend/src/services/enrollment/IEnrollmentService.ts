import type { AuthenticatedUser } from "@/types/auth.js";
import type {
  ConfirmAttendanceInput,
  EnrollResponse,
  EnrollmentListResponse,
  EnrollmentResponse,
  ParticipantsListResponse,
} from "@/types/enrollment.js";

export interface IEnrollmentService {
  enroll(userId: string, activityId: string): Promise<EnrollResponse>;
  cancel(userId: string, activityId: string): Promise<void>;
  listActiveByUser(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<EnrollmentListResponse>;
  listParticipants(
    user: Pick<AuthenticatedUser, "id" | "isManager">,
    activityId: string,
    page?: number,
    limit?: number,
  ): Promise<ParticipantsListResponse>;
  confirmAttendance(
    user: Pick<AuthenticatedUser, "id" | "isManager">,
    enrollmentId: string,
    input: ConfirmAttendanceInput,
  ): Promise<EnrollmentResponse>;
}
