import { useEffect, useId, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import type {
  ConfirmAttendanceRequest,
  Enrollment,
  EnrollmentListItem,
} from "@/services/contracts/enrollment";
import { confirmAttendance } from "../services";
import { resolveAttendanceError } from "../errors";
import { validateWorkloadHours } from "../validators";

type Choice = "present" | "absent";

interface AttendanceModalProps {
  enrollment: EnrollmentListItem;
  /** The activity's workload: the most hours a presence can be homologated with. */
  workloadCeiling: number;
  onClose: () => void;
  onSaved: (updated: Enrollment) => void;
  /** The list no longer matches the server; `message` says why. */
  onStale: (message: string) => void;
}

function initialChoice(enrollment: Enrollment): Choice | null {
  if (enrollment.attendanceConfirmed === null) return null;
  return enrollment.attendanceConfirmed ? "present" : "absent";
}

/**
 * Homologates, or corrects, the attendance of one enrollment. Presence and
 * hours are one pair on the wire: a presence always carries the hours, an
 * absence never does.
 */
export function AttendanceModal({
  enrollment,
  workloadCeiling,
  onClose,
  onSaved,
  onStale,
}: AttendanceModalProps) {
  const titleId = useId();
  const [choice, setChoice] = useState<Choice | null>(() =>
    initialChoice(enrollment),
  );
  // Most volunteers serve the whole workload, so it is the suggestion; a
  // presence already on record keeps its own hours, so a correction starts
  // from what is confirmed.
  const [hours, setHours] = useState(() =>
    String(
      enrollment.attendanceConfirmed
        ? enrollment.confirmedWorkloadHours
        : workloadCeiling,
    ),
  );
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // State alone lets a second click of a double click through before the
  // re-render disables the button.
  const inFlight = useRef(false);

  // An absence only hides the hours: they are never sent with it, and a
  // misclick on Falta while correcting must not lose the confirmed hours.
  const choose = (next: Choice) => {
    setChoice(next);
    setHoursError(null);
    setErrorMessage(null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !inFlight.current) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || choice === null) return;

    let body: ConfirmAttendanceRequest;
    if (choice === "present") {
      const invalid = validateWorkloadHours(hours, workloadCeiling);
      if (invalid) {
        setHoursError(invalid);
        return;
      }
      body = { attended: true, workloadHours: Number(hours) };
    } else {
      body = { attended: false };
    }

    inFlight.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    setHoursError(null);

    try {
      const updated = await confirmAttendance(enrollment.id, body);
      toast.success(
        body.attended ? "Presença homologada." : "Falta registrada.",
      );
      onSaved(updated);
    } catch (err) {
      const resolution = resolveAttendanceError(err);

      switch (resolution.kind) {
        case "sessionExpired":
          break;
        case "stale":
          onStale(resolution.text);
          break;
        case "field":
          // With an absence the hours field is hidden, so its error would
          // have nowhere to show.
          if (choice === "present") setHoursError(resolution.text);
          else setErrorMessage(resolution.text);
          break;
        case "message":
          setErrorMessage(resolution.text);
          break;
        default: {
          const exhaustive: never = resolution;
          return exhaustive;
        }
      }
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/40 cursor-pointer"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <form
          noValidate
          onSubmit={handleSubmit}
          className="px-8 py-8 flex flex-col gap-5"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-14 rounded-full bg-blue-100 flex items-center justify-center">
              <ClipboardCheck className="size-7 text-[#072C59]" />
            </div>
            <div>
              <h2 id={titleId} className="text-xl font-bold text-gray-900">
                Homologar presença
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {enrollment.user.fullName}
              </p>
            </div>
          </div>

          <fieldset className="space-y-2" disabled={isSubmitting}>
            <legend className="text-sm font-medium text-gray-900 mb-2">
              Participação
            </legend>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-sm text-gray-700 transition hover:bg-gray-50">
              <input
                type="radio"
                name="attendance"
                className="size-4 cursor-pointer accent-[#072C59]"
                checked={choice === "present"}
                onChange={() => choose("present")}
              />
              Presente
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-sm text-gray-700 transition hover:bg-gray-50">
              <input
                type="radio"
                name="attendance"
                className="size-4 cursor-pointer accent-[#072C59]"
                checked={choice === "absent"}
                onChange={() => choose("absent")}
              />
              Falta
            </label>
          </fieldset>

          {choice === "present" && (
            <div>
              <Input
                label="Horas cumpridas"
                type="number"
                inputMode="numeric"
                min={1}
                max={workloadCeiling}
                step={1}
                value={hours}
                disabled={isSubmitting}
                error={hoursError ?? undefined}
                onChange={(event) => {
                  setHours(event.target.value);
                  setHoursError(null);
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Carga horária da ação: {workloadCeiling} h
              </p>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="w-full border border-red-200 bg-red-50 rounded-xl px-5 py-4 text-sm text-left text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex gap-4 w-full">
            <Button
              type="button"
              variant="secondary"
              size="md"
              rounded
              className="flex-1"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              rounded
              className="flex-1"
              disabled={isSubmitting || choice === null}
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
