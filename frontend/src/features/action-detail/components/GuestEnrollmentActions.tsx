import { Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "../../../components/Button";
import { getUnavailableEnrollmentLabel } from "../enrollment";
import { UnavailableEnrollmentButton } from "./UnavailableEnrollmentButton";
import type { ReturnToState } from "@/routes/GuestRoute";
import type { Activity } from "@/services/contracts/activity";

interface GuestEnrollmentActionsProps {
  action: Activity;
}

/**
 * Enrollment controls of the detail page, for a visitor. Signing in sends
 * them back here through GuestRoute; enrolling is still their own click.
 */
export function GuestEnrollmentActions({
  action,
}: GuestEnrollmentActionsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const unavailableLabel = getUnavailableEnrollmentLabel(action);
  const returnTo: ReturnToState = { from: location };

  // No point inviting someone to sign in for an enrollment they cannot make.
  if (unavailableLabel) {
    return <UnavailableEnrollmentButton label={unavailableLabel} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="navy"
        size="lg"
        onClick={() => navigate("/login", { state: returnTo })}
        className="flex items-center justify-center gap-3 rounded-xl"
      >
        <Users className="size-6" />
        Entrar para se inscrever
      </Button>
      <p className="text-sm text-gray-600 text-center">
        Não tem conta?{" "}
        <Link
          to="/register"
          state={returnTo}
          className="font-medium text-[#1B75BB] hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
}
