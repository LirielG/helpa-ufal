import { useRef, useState } from "react";
import { MapPin, Calendar, Trash2 } from "lucide-react";
import type { ActivityStatus } from "@/services/contracts/activity";
import { ApiError } from "@/services/apiError";
import type { ActivityStatusTransition, UserActivity } from "../../types";
import {
  updateActivityStatus,
  getActivityById,
  deleteActivity,
} from "../../services";
import { ConfirmStatusModal } from "./ConfirmStatusModal";
import { DeleteActionModal } from "./DeleteActionModal";
import { ActionCover } from "@/components/ActionCover";
import { Button } from "@/components/Button";
import { ACTION_STATUS_LABELS } from "../../../dashboard/constants";
import { toast } from "react-toastify";

const STATUS_BADGE_CLASSES: Record<ActivityStatus, string> = {
  OPEN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IN_PROGRESS: "bg-blue-50 text-[#1B75BB] border-blue-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const NOT_FOUND_MESSAGE =
  "Esta ação não foi encontrada. Ela pode ter sido removida.";

type ManagedCardProps = {
  activity: UserActivity;
  onEdit: (id: string) => void;
  onManageEnrollments: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ManagedCard({
  activity,
  onEdit,
  onManageEnrollments,
  onDelete,
}: ManagedCardProps) {
  const [currentStatus, setCurrentStatus] = useState<ActivityStatus>(
    activity.action.status,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatus, setPendingStatus] =
    useState<ActivityStatusTransition | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [errorState, setErrorState] = useState<{
    message: string;
    isLocked?: boolean;
    canRetry?: boolean;
    retryStatus?: ActivityStatusTransition;
  } | null>(null);

  const isSubmittingRef = useRef(false);

  const isLocked = errorState?.isLocked === true;
  const canTransition =
    currentStatus === "OPEN" || currentStatus === "IN_PROGRESS";

  const reloadAfterConflict = async () => {
    setErrorState({
      message:
        "O status desta ação foi alterado em outro lugar. Exibindo o status atual.",
    });
    try {
      const updated = await getActivityById(activity.action.id);
      setCurrentStatus(updated.status);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 401) return;

      setErrorState({
        message:
          status === 404
            ? NOT_FOUND_MESSAGE
            : "Não foi possível carregar o status atual. Recarregue a página.",
        // A stale status would only offer transitions that end in another 409.
        isLocked: true,
      });
    }
  };

  const performStatusUpdate = async (
    targetStatus: ActivityStatusTransition,
  ) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    setErrorState(null);

    try {
      await updateActivityStatus(activity.action.id, targetStatus);
      setCurrentStatus(targetStatus);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : undefined;

      // The HTTP client already ends the session and redirects to /login.
      if (status === 401) return;

      if (status === 403) {
        setErrorState({
          message: "Você não tem permissão para alterar o status desta ação.",
        });
      } else if (status === 404) {
        setErrorState({ message: NOT_FOUND_MESSAGE, isLocked: true });
      } else if (status === 409) {
        await reloadAfterConflict();
      } else {
        setErrorState({
          message:
            "Não foi possível alterar o status. Verifique sua conexão e tente novamente.",
          canRetry: true,
          retryStatus: targetStatus,
        });
      }
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteActivity(activity.action.id);
      toast.success("Ação excluída.");
      setShowDeleteModal(false);
      onDelete(activity.action.id);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : undefined;

      if (status === 401) return;

      // Already removed elsewhere: the outcome the user wanted has happened.
      if (status === 404) {
        setShowDeleteModal(false);
        onDelete(activity.action.id);
      } else if (status === 403) {
        setDeleteError("Você não tem permissão para excluir esta ação.");
      } else {
        setDeleteError(
          "Não foi possível excluir a ação. Verifique sua conexão e tente novamente.",
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = () => {
    if (errorState?.retryStatus) {
      performStatusUpdate(errorState.retryStatus);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md flex flex-col">
      <ActionCover
        id={activity.action.id}
        type={activity.action.type}
        className="h-48 shrink-0"
      />
      <div className="p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col justify-between gap-3 min-w-0 flex-1">
            <div>
              <h4 className="font-bold text-gray-900 leading-snug text-lg mb-1">
                {activity.action.title}
              </h4>
              <p className="text-sm text-gray-600">{activity.description}</p>
            </div>

            <div className="flex items-center gap-6 flex-wrap text-xs font-medium text-gray-500 mt-2">
              <span className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-gray-400" />
                {activity.location}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="size-4 shrink-0 text-gray-400" />
                {activity.date}
              </span>
            </div>
          </div>

          <span
            className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE_CLASSES[currentStatus]}`}
          >
            {ACTION_STATUS_LABELS[currentStatus]}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
          {canTransition && (
            <div className="flex flex-wrap items-center gap-2">
              {currentStatus === "OPEN" && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isLoading || isLocked}
                  onClick={() => setPendingStatus("IN_PROGRESS")}
                >
                  Iniciar ação
                </Button>
              )}

              {currentStatus === "IN_PROGRESS" && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isLoading || isLocked}
                  onClick={() => setPendingStatus("COMPLETED")}
                >
                  Concluir ação
                </Button>
              )}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isLoading || isLocked}
                onClick={() => setPendingStatus("CANCELLED")}
              >
                Cancelar ação
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onEdit(activity.action.id)}
            >
              Editar
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onManageEnrollments(activity.action.id)}
            >
              Inscritos
            </Button>

            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="size-4 shrink-0" />
                Excluir
              </span>
            </Button>
          </div>
        </div>

        {errorState && (
          <div
            role="alert"
            className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2"
          >
            <span>{errorState.message}</span>
            {errorState.canRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors shrink-0"
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}

        {pendingStatus && (
          <ConfirmStatusModal
            activity={activity}
            pendingStatus={pendingStatus}
            isLoading={isLoading}
            onConfirm={() => {
              const target = pendingStatus;
              setPendingStatus(null);
              performStatusUpdate(target);
            }}
            onCancel={() => setPendingStatus(null)}
          />
        )}

        {showDeleteModal && (
          <DeleteActionModal
            isLoading={isDeleting}
            errorMessage={deleteError}
            onConfirmDelete={handleConfirmDelete}
            onClose={() => {
              setShowDeleteModal(false);
              setDeleteError(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
