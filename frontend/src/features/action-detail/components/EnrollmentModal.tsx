import { useState } from "react";
import { useNavigate } from "react-router";
import { UserPlus, CheckCircle, MapPin, Calendar, Clock } from "lucide-react";
import { Button } from "../../../components/Button";
import { Alert } from "../../../components/Alert";
import { enrollInAction } from "../services";
import type { ActionDetail } from "../types";

type ModalStep = "confirm" | "loading" | "success" | "error";

interface EnrollmentModalProps {
  action: ActionDetail;
  onClose: () => void;
}

export function EnrollmentModal({ action, onClose }: EnrollmentModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<ModalStep>("confirm");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setStep("loading");
    try {
      await enrollInAction(action.id);
      setStep("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Erro ao realizar inscrição. Tente novamente.",
      );
      setStep("error");
    }
  };

  const handleBackToFeed = () => {
    onClose();
    navigate("/dashboard");
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setStep("confirm");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 bg-black/40 cursor-pointer"
        onClick={step !== "loading" ? onClose : undefined}
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 py-8 flex flex-col items-center gap-5 text-center">
          {step === "success" && (
            <>
              <div className="size-16 rounded-xl bg-[#1a4a1a] flex items-center justify-center">
                <CheckCircle className="size-9 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Oba! Você está dentro!
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Sua inscrição foi confirmada
                </p>
              </div>
              <Button
                variant="navy"
                size="lg"
                onClick={handleBackToFeed}
                className="flex items-center justify-center gap-2 mt-2"
              >
                ← Voltar para o feed
              </Button>
            </>
          )}

          {step === "error" && (
            <>
              <Alert
                type="error"
                message={errorMessage ?? "Erro ao realizar inscrição."}
                onClose={handleRetry}
              />
              <div className="flex gap-3 w-full">
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={onClose}
                >
                  Fechar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={handleRetry}
                >
                  Tentar novamente
                </Button>
              </div>
            </>
          )}

          {(step === "confirm" || step === "loading") && (
            <>
              <div className="size-14 rounded-full bg-blue-100 flex items-center justify-center">
                <UserPlus className="size-7 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Confirmar inscrição
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Você está prestes a se escrever em:
                </p>
              </div>
              <div className="w-full bg-gray-100 rounded-xl px-5 py-4 text-left space-y-2">
                <p className="font-semibold text-gray-900">{action.title}</p>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="size-4 shrink-0 text-gray-400" />
                  <span>{action.startDate}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="size-4 shrink-0 text-gray-400" />
                  <span>{action.city}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="size-4 shrink-0 text-gray-400" />
                  <span>{action.workloadHours} horas</span>
                </div>
              </div>
              <div className="w-full border border-yellow-300 bg-yellow-50 rounded-xl px-5 py-4 text-sm text-left text-yellow-800">
                <span className="font-semibold">Atenção: </span>
                Ao confirmar, você se compromete a participar da atividade.
                Certifique-se de estar disponível nas datas e horários
                informados.
              </div>
              <div className="flex gap-3 w-full">
                <Button
                  variant="danger"
                  size="md"
                  className="flex-1"
                  disabled={step === "loading"}
                  onClick={onClose}
                >
                  ✕ Cancelar
                </Button>
                <Button
                  variant="navy"
                  size="md"
                  className="flex-1"
                  isLoading={step === "loading"}
                  onClick={handleConfirm}
                >
                  ✓ Confirmar inscrição
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
