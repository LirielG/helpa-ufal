import { Users } from "lucide-react";
import { Button } from "../../../components/Button";
import type { UnavailableEnrollmentLabel } from "../enrollment";

interface UnavailableEnrollmentButtonProps {
  label: UnavailableEnrollmentLabel;
}

export function UnavailableEnrollmentButton({
  label,
}: UnavailableEnrollmentButtonProps) {
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
