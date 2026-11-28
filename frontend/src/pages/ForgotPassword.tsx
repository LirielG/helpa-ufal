import { useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Mail } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Alert, Button, HomeLogoLink } from "../components";
import { PageTitle } from "../components/PageTitle";
import helpaBlueLogo from "../assets/helpa-logo-blue.svg";
import { AuthField } from "../features/auth/components/AuthField";
import { AuthFooterLink } from "../features/auth/components/AuthFooterLink";
import { AuthShell } from "../features/auth/components/AuthShell";
import { FORGOT_PASSWORD_SUCCESS_MESSAGE } from "../features/auth/constants/messages";
import { getForgotPasswordErrorMessage } from "../features/auth/errors";
import type { ReturnToState } from "../routes/GuestRoute";
import { authService } from "../services/auth";
import {
  ForgotPasswordSchema,
  type ForgotPasswordFields,
} from "../validators/auth";

type ForgotPasswordRouteState = ReturnToState & {
  email?: string;
};

export function ForgotPassword() {
  const { state } = useLocation();
  const routeState = state as ForgotPasswordRouteState | null;
  const returnTo: ReturnToState = { from: routeState?.from };

  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFields>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: routeState?.email ?? "",
    },
    mode: "onSubmit",
  });

  const onSubmit = async (data: ForgotPasswordFields) => {
    if (isSendingRef.current) return;

    setFormError(null);
    isSendingRef.current = true;
    setIsSending(true);

    try {
      await authService.requestPasswordReset({ email: data.email });
      setSubmittedEmail(data.email);
    } catch (error) {
      setFormError(getForgotPasswordErrorMessage(error));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleSendAgain = () => {
    setFormError(null);
    if (submittedEmail !== null) {
      reset({ email: submittedEmail });
    }
    setSubmittedEmail(null);
  };

  return (
    <AuthShell
      header={
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <HomeLogoLink
              src={helpaBlueLogo}
              imageClassName="h-8 md:h-10 w-auto"
            />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Esqueci minha senha
          </h1>
        </div>
      }
      footer={
        <AuthFooterLink
          prefix="Lembrou a senha?"
          linkText="Entrar"
          to="/login"
          state={returnTo}
        />
      }
    >
      <PageTitle title="Esqueci minha senha" />

      {submittedEmail !== null ? (
        <div className="space-y-6">
          <Alert type="success" message={FORGOT_PASSWORD_SUCCESS_MESSAGE} />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <Link
              to="/reset-password"
              state={{ ...returnTo, email: submittedEmail }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Já tenho um código
            </Link>

            <button
              type="button"
              onClick={handleSendAgain}
              className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer text-left sm:text-right"
            >
              Enviar novamente
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-6">
            Informe o e-mail da sua conta. Enviaremos um código para você criar
            uma nova senha.
          </p>

          {formError && (
            <div className="mb-6">
              <Alert type="error" message={formError} />
            </div>
          )}

          <form
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
            className="space-y-5"
            noValidate
          >
            <AuthField
              label="E-mail"
              type="email"
              placeholder="seu.email@exemplo.com"
              icon={<Mail className="size-5" />}
              error={errors.email?.message}
              registration={register("email")}
            />

            <Button
              type="submit"
              size="lg"
              isLoading={isSending}
              variant="navy"
            >
              Enviar código
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
