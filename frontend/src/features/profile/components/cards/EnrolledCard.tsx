import { useState } from "react";
import { Link } from "react-router";
import { MapPin, Calendar } from "lucide-react";
import { CancelEnrollmentModal } from "@/features/action-detail/components/CancelEnrollmentModal";
import type { UserActivity } from "../../types";
import { ActionCover } from "@/components/ActionCover";
import { Button } from "@/components/Button";

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
    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md flex flex-col">
      <ActionCover
        id={activity.action.id}
        type={activity.action.type}
        className="h-48 shrink-0"
      />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h4 className="font-bold text-gray-900 leading-snug">
          <Link
            to={`/activity/${activity.action.id}`}
            className="hover:text-[#00579A] transition-colors after:absolute after:inset-0"
          >
            {activity.action.title}
          </Link>
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

        <div className="mt-auto pt-2 flex items-center justify-between gap-3 flex-wrap">
          <Link
            to={`/activity/${activity.action.id}`}
            className="relative z-10 px-4 py-2 border border-[#00579A] text-[#00579A] hover:bg-[#00579A] hover:text-white rounded-lg text-sm font-semibold transition-colors text-center"
          >
            Ver detalhes
          </Link>

          {canCancel && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="relative z-10"
            >
              Cancelar inscrição
            </Button>
          )}
        </div>

        {showCancelModal && (
          <CancelEnrollmentModal
            action={activity.action}
            onClose={() => setShowCancelModal(false)}
            onCancelled={handleGone}
            onActivityRemoved={handleGone}
            onRemovedByModeration={handleGone}
            onActivityClosed={() => setIsClosed(true)}
          />
        )}
      </div>
    </div>
  );
}
