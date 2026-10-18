import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { UserMinus, MapPin, Calendar, Clock } from "lucide-react";
import { Button } from "../../../components/Button";
import { cancelEnrollment } from "../services";
import { resolveCancellationError } from "../errors";
import type { Activity } from "@/services/contracts/activity";
import { formatDate } from "../../../utils";
import {
  ACTION_CAMPUS_LABELS,
  ACTION_FORMAT_LABELS,
} from "../../dashboard/constants";

interface CancelEnrollmentModalProps {
  action: Activity;
  onClose: () => void;
  /** The enrollment is no longer active, whether by this request or a concurrent one. */
  onCancelled: () => void;
  onActivityRemoved: () => void;
}

export function CancelEnrollmentModal({
  action,
  onClose,
  onCancelled,
  onActivityRemoved,
}: CancelEnrollmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // State alone lets a second click of a double click through before the
  // re-render disables the button.
  const inFlight = useRef(false);

  const address = action.details?.address;
  const format = action.details?.format;
  const location = address
    ? `${address.city} - ${address.state}`
    : format
      ? ACTION_FORMAT_LABELS[format]
      : ACTION_CAMPUS_LABELS[action.campus];

  const handleConfirm = async () => {
    if (inFlight.current) return;

    inFlight.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await cancelEnrollment(action.id);
      toast.success("Inscrição cancelada.");
      onCancelled();
    } catch (err) {
      const resolution = resolveCancellationError(err);

      switch (resolution.kind) {
        case "alreadyCancelled":
          onCancelled();
          break;
        case "activityRemoved":
          onActivityRemoved();
          break;
        case "sessionExpired":
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

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 py-8 flex flex-col items-center gap-5 text-center">
          <div className="size-14 rounded-full bg-red-100 flex items-center justify-center">
            <UserMinus className="size-7 text-red-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Cancelar inscrição
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Você está prestes a cancelar sua inscrição em:
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-xl px-5 py-4 text-left space-y-2">
            <p className="font-semibold text-gray-900">{action.title}</p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="size-4 shrink-0 text-gray-400" />
              <span>{formatDate(action.startDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="size-4 shrink-0 text-gray-400" />
              <span>{location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="size-4 shrink-0 text-gray-400" />
              <span>{action.details?.workloadHours ?? 0} horas</span>
            </div>
          </div>
          <div className="w-full border border-yellow-300 bg-yellow-50 rounded-xl px-5 py-4 text-sm text-left text-yellow-800">
            <span className="font-semibold">Atenção: </span>
            Ao confirmar, a vaga é liberada de imediato e pode ser ocupada por
            outra pessoa.
          </div>

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
              variant="secondary"
              size="md"
              rounded
              className="flex-1"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Manter inscrição
            </Button>
            <Button
              variant="danger"
              size="md"
              rounded
              className="flex-1"
              disabled={isSubmitting}
              onClick={handleConfirm}
            >
              {isSubmitting ? "Cancelando..." : "Cancelar inscrição"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
