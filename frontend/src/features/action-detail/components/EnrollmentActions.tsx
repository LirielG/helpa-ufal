import { CheckCircle, UserMinus, Users } from "lucide-react";
import { Button } from "../../../components/Button";
import type { Activity } from "@/services/contracts/activity";

interface EnrollmentActionsProps {
  action: Activity;
  onEnroll: () => void;
  onCancel: () => void;
}

/**
 * Enroll/cancel controls of the detail page, for a signed-in user.
 *
 * PENDING counts as enrolled: no flow produces it today, and the API cancels
 * it like APPROVED. An absent enrollmentStatus with a stored session means
 * the server no longer recognizes it; enrolling then answers 401 and the
 * session handler takes over.
 */
export function EnrollmentActions({
  action,
  onEnroll,
  onCancel,
}: EnrollmentActionsProps) {
  const isOpen = action.status === "OPEN";
  const isEnrolled =
    action.enrollmentStatus === "APPROVED" ||
    action.enrollmentStatus === "PENDING";

  if (isEnrolled) {
    return (
      <div className="flex flex-col gap-3">
        <div className="w-full py-4 rounded-xl bg-green-700 text-white text-lg font-medium flex items-center justify-center gap-3">
          <CheckCircle className="size-6" />
          Inscrito
        </div>
        {isOpen ? (
          <Button
            variant="danger"
            size="lg"
            onClick={onCancel}
            className="flex items-center justify-center gap-3 rounded-xl"
          >
            <UserMinus className="size-6" />
            Cancelar inscrição
          </Button>
        ) : (
          <p className="text-sm text-gray-500 text-center">
            Cancelamento não está mais disponível
          </p>
        )}
      </div>
    );
  }

  const label =
    action.enrollmentStatus === "REJECTED" || !isOpen
      ? "Inscrição indisponível"
      : action.availableSlots === 0
        ? "Vagas esgotadas"
        : null;

  if (label) {
    return (
      <Button
        variant="secondary"
        size="lg"
        disabled
        className="flex items-center justify-center gap-3 rounded-xl"
      >
        <Users className="size-6" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant="navy"
      size="lg"
      onClick={onEnroll}
      className="flex items-center justify-center gap-3 rounded-xl"
    >
      <Users className="size-6" />
      Inscrever-se
    </Button>
  );
}
