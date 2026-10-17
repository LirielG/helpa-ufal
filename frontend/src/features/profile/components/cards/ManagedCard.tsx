import { useRef, useState } from "react";
import { MapPin, Calendar, Pencil, Trash2, Users } from "lucide-react";
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

// The current status first, then only the transitions the backend accepts.
const STATUS_OPTIONS: Record<
  ActivityStatus,
  { value: ActivityStatus; label: string }[]
> = {
  OPEN: [
    { value: "OPEN", label: "Aberta" },
    { value: "IN_PROGRESS", label: "Em andamento" },
    { value: "CANCELLED", label: "Cancelada" },
  ],
  IN_PROGRESS: [
    { value: "IN_PROGRESS", label: "Em andamento" },
    { value: "COMPLETED", label: "Concluída" },
    { value: "CANCELLED", label: "Cancelada" },
  ],
  COMPLETED: [{ value: "COMPLETED", label: "Concluída" }],
  CANCELLED: [{ value: "CANCELLED", label: "Cancelada" }],
};

const NOT_FOUND_MESSAGE =
  "Esta ação não foi encontrada. Ela pode ter sido removida.";

type ManagedCardProps = {
  activity: UserActivity;
  onEdit: (id: string) => void;
  onManageEnrollments: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function ManagedCard({
  activity,
  onEdit,
  onManageEnrollments,
  onDelete,
}: ManagedCardProps) {
  const [currentStatus, setCurrentStatus] = useState<ActivityStatus>(
    activity.activityStatus,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatus, setPendingStatus] =
    useState<ActivityStatusTransition | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeletedSuccess, setShowDeletedSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [errorState, setErrorState] = useState<{
    message: string;
    isLocked?: boolean;
    canRetry?: boolean;
    retryStatus?: ActivityStatusTransition;
  } | null>(null);

  const isSubmittingRef = useRef(false);

  const isTerminal =
    currentStatus === "COMPLETED" || currentStatus === "CANCELLED";
  const isLocked = errorState?.isLocked === true;

  const reloadAfterConflict = async () => {
    setErrorState({
      message:
        "O status desta ação foi alterado em outro lugar. Exibindo o status atual.",
    });
    try {
      const updated = await getActivityById(activity.id);
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
      await updateActivityStatus(activity.id, targetStatus);
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
      await deleteActivity(activity.id);
      setShowDeleteModal(false);
      setShowDeletedSuccess(true);
      onDelete?.(activity.id);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : undefined;

      if (status === 401) return;

      if (status === 404) {
        setShowDeleteModal(false);
        onDelete?.(activity.id);
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

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as ActivityStatus;
    if (selected === currentStatus || selected === "OPEN") return;

    const transitionStatus = selected as ActivityStatusTransition;

    if (transitionStatus === "IN_PROGRESS") {
      performStatusUpdate("IN_PROGRESS");
    } else {
      setPendingStatus(transitionStatus);
    }
  };

  const handleRetry = () => {
    if (errorState?.retryStatus) {
      performStatusUpdate(errorState.retryStatus);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 transition-all hover:shadow-md flex flex-col gap-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col justify-between gap-3 min-w-0 flex-1">
          <div>
            <h4 className="font-bold text-gray-900 leading-snug text-lg mb-1">
              {activity.title}
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

        <div className="flex flex-col items-end justify-between self-stretch gap-4 shrink-0">
          <div className="flex flex-col items-start gap-1">
            <label
              htmlFor={`status-select-${activity.id}`}
              className="text-xs font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id={`status-select-${activity.id}`}
              value={currentStatus}
              onChange={handleSelectChange}
              disabled={isLoading || isTerminal || isLocked}
              className="border border-gray-300 rounded-lg px-3 py-1.5 font-medium text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {STATUS_OPTIONS[currentStatus].map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-white text-gray-800 py-1.5 px-3 hover:bg-gray-200"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              aria-label="Excluir atividade"
              className="text-red-400 hover:text-red-600 transition-colors p-1"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(activity.id)}
              aria-label="Editar atividade"
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onManageEnrollments(activity.id)}
              aria-label="Gerenciar inscritos"
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <Users className="size-4" />
            </button>
          </div>
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

      {(showDeleteModal || showDeletedSuccess) && (
        <DeleteActionModal
          isSuccess={showDeletedSuccess}
          isLoading={isDeleting}
          errorMessage={deleteError}
          onConfirmDelete={handleConfirmDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setShowDeletedSuccess(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
