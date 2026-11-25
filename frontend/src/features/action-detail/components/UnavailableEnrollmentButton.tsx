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
      className="rounded-xl"
    >
      {label}
    </Button>
  );
}
