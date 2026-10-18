import { useState } from "react";
import { MapPin, Calendar } from "lucide-react";
import { CancelEnrollmentModal } from "@/features/action-detail/components/CancelEnrollmentModal";
import type { UserActivity } from "../../types";

type EnrolledCardProps = {
  activity: UserActivity;
  /** The enrollment is gone, or the action itself: the card leaves the list. */
  onCancelled: (id: string) => void;
};

export function EnrolledCard({ activity, onCancelled }: EnrolledCardProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  // A 409 means the action left OPEN after the list loaded; hide the button
  // instead of offering a cancellation the API will refuse again.
  const [isClosed, setIsClosed] = useState(false);

  const canCancel = activity.action.status === "OPEN" && !isClosed;

  const handleGone = () => {
    setShowCancelModal(false);
    onCancelled(activity.action.id);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 transition-all hover:shadow-md flex flex-col gap-3">
      <h4 className="font-bold text-gray-900 leading-snug">
        {activity.action.title}
      </h4>
      <p className="text-sm text-gray-600">{activity.description}</p>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <MapPin className="size-4 shrink-0 text-gray-400" />
        <span>{activity.location}</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="size-4 shrink-0 text-gray-400" />
        <span>{activity.date}</span>
      </div>

      {canCancel && (
        <button
          type="button"
          onClick={() => setShowCancelModal(true)}
          className="self-end px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          Cancelar
        </button>
      )}

      {showCancelModal && (
        <CancelEnrollmentModal
          action={activity.action}
          onClose={() => setShowCancelModal(false)}
          onCancelled={handleGone}
          onActivityRemoved={handleGone}
          onActivityClosed={() => setIsClosed(true)}
        />
      )}
    </div>
  );
}
