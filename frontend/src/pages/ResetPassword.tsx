import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { KeyRound, Mail } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Alert, Button, HomeLogoLink } from "../components";
import { PageTitle } from "../components/PageTitle";
import helpaBlueLogo from "../assets/helpa-logo-blue.svg";
import { AuthField } from "../features/auth/components/AuthField";
import { AuthFooterLink } from "../features/auth/components/AuthFooterLink";
import { AuthShell } from "../features/auth/components/AuthShell";
import { PasswordField } from "../features/auth/components/PasswordField";
import { PasswordGuidelines } from "../features/auth/components/PasswordGuidelines";
import { RESET_PASSWORD_SUCCESS_MESSAGE } from "../features/auth/constants/messages";
import { getResetPasswordError } from "../features/auth/errors";
import type { ReturnToState } from "../routes/GuestRoute";
import { authService } from "../services/auth";
import {
  ResetPasswordSchema,
  VerifyResetCodeSchema,
  type ResetPasswordFields,
  type VerifyResetCodeFields,
} from "../validators/auth";

type ResetPasswordRouteState = ReturnToState & {
  email?: string;
};

type VerifiedResetTarget = {
  email: string;
  code: string;
};

type ParsedResetHash = {
  email: string;
  code: string;
  hasResetParams: boolean;
};

function parseResetHash(hash: string): ParsedResetHash {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return { email: "", code: "", hasResetParams: false };

  const params = new URLSearchParams(raw);
  const email = params.get("email")?.trim() ?? "";
  const code = params.get("code")?.trim() ?? "";

  return {
    email,
    code,
    hasResetParams: params.has("email") || params.has("code"),
  };
}

export function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as ResetPasswordRouteState | null;
  const returnTo: ReturnToState = { from: routeState?.from };

  // Captured once on mount because the fragment is immediately stripped from
  // the URL so the code never stays in browser history.
  const [initialParams] = useState(() => {
    const fromHash = parseResetHash(location.hash);
    const email = fromHash.email || routeState?.email?.trim() || "";
    const code = fromHash.code;
    const canAutoVerify =
      Boolean(fromHash.code) &&
      VerifyResetCodeSchema.safeParse({ email, code }).success;

    return { email, code, canAutoVerify };
  });

  const [verifiedTarget, setVerifiedTarget] =
    useState<VerifiedResetTarget | null>(null);
  const [isAutoVerifying, setIsAutoVerifying] = useState(
    initialParams.canAutoVerify,
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showRequestNewCodeLink, setShowRequestNewCodeLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const latestAutoVerifyRef = useRef(0);
  const isSubmittingRef = useRef(false);

  const {
    register: registerVerify,
    handleSubmit: handleVerifySubmit,
    control: verifyControl,
    setError: setVerifyError,
    reset: resetVerifyForm,
    formState: { errors: verifyErrors },
  } = useForm<VerifyResetCodeFields>({
    resolver: zodResolver(VerifyResetCodeSchema),
    defaultValues: {
      email: initialParams.email,
      code: initialParams.code,
    },
    mode: "onSubmit",
  });

  const currentEmail = useWatch({
    control: verifyControl,
    name: "email",
    defaultValue: initialParams.email,
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    control: resetControl,
    reset: resetPasswordForm,
    formState: { errors: resetErrors },
  } = useForm<ResetPasswordFields>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
    mode: "onSubmit",
  });

  const newPassword = useWatch({
    control: resetControl,
    name: "newPassword",
    defaultValue: "",
  });

  // Strip the fragment as soon as it arrives so the reset code does not linger
  // in the browser address bar or history.
  useEffect(() => {
    if (!location.hash || !parseResetHash(location.hash).hasResetParams) {
      return;
    }

    const cleanUrl = `${location.pathname}${location.search}`;
    window.history.replaceState(null, "", cleanUrl);
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: "",
      },
      { replace: true, state: location.state },
    );
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  // Visitors arriving from the e-mail link skip step 1 automatically when the
  // code checks out.
  useEffect(() => {
    if (!initialParams.canAutoVerify) return;

    latestAutoVerifyRef.current += 1;
    const requestId = latestAutoVerifyRef.current;

    authService
      .verifyPasswordResetCode({
        email: initialParams.email,
        code: initialParams.code,
      })
      .then(() => {
        if (requestId !== latestAutoVerifyRef.current) return;
        setVerifiedTarget({
          email: initialParams.email,
          code: initialParams.code,
        });
        setIsAutoVerifying(false);
      })
      .catch((error: unknown) => {
        if (requestId !== latestAutoVerifyRef.current) return;
        const resolved = getResetPasswordError(error);
        if (resolved.kind === "invalidCode") {
          setVerifyError("code", {
            type: "server",
            message: resolved.message,
          });
          setShowRequestNewCodeLink(true);
        } else {
          setFormError(resolved.message);
        }
        setIsAutoVerifying(false);
      });

    return () => {
      latestAutoVerifyRef.current += 1;
    };
  }, [initialParams, setVerifyError]);

  const onVerifySubmit = async (data: VerifyResetCodeFields) => {
    if (isSubmittingRef.current || isAutoVerifying) return;

    setFormError(null);
    setShowRequestNewCodeLink(false);
    isSubmittingRef.current = true;
    setIsVerifying(true);

    try {
      await authService.verifyPasswordResetCode({
        email: data.email,
        code: data.code,
      });
      resetPasswordForm();
      setVerifiedTarget({ email: data.email, code: data.code });
    } catch (error) {
      const resolved = getResetPasswordError(error);
      if (resolved.kind === "invalidCode") {
        setVerifyError("code", {
          type: "server",
          message: resolved.message,
        });
        setShowRequestNewCodeLink(true);
      } else {
        setFormError(resolved.message);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsVerifying(false);
    }
  };

  const onResetSubmit = async (data: ResetPasswordFields) => {
    if (!verifiedTarget || isSubmittingRef.current) return;

    setFormError(null);
    isSubmittingRef.current = true;
    setIsResetting(true);

    try {
      await authService.resetPassword({
        email: verifiedTarget.email,
        code: verifiedTarget.code,
        newPassword: data.newPassword,
      });
    } catch (error) {
      const resolved = getResetPasswordError(error);
      if (resolved.kind === "invalidCode") {
        // The code expired or was invalidated between steps: return to step 1
        // with the field error and the link to request a fresh code.
        resetVerifyForm({
          email: verifiedTarget.email,
          code: verifiedTarget.code,
        });
        setVerifyError("code", {
          type: "server",
          message: resolved.message,
        });
        setShowRequestNewCodeLink(true);
        setVerifiedTarget(null);
      } else {
        setFormError(resolved.message);
      }
      return;
    } finally {
      isSubmittingRef.current = false;
      setIsResetting(false);
    }

    navigate("/login", {
      replace: true,
      state: {
        ...returnTo,
        successMessage: RESET_PASSWORD_SUCCESS_MESSAGE,
      },
    });
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
            Redefinir senha
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
      <PageTitle title="Redefinir senha" />

      {formError && (
        <div className="mb-6">
          <Alert type="error" message={formError} />
        </div>
      )}

      {verifiedTarget ? (
        <form
          onSubmit={(event) => void handleResetSubmit(onResetSubmit)(event)}
          className="space-y-5"
          noValidate
        >
          <p className="text-sm text-gray-600">
            Crie uma nova senha para a sua conta.
          </p>

          <PasswordField
            label="Nova senha"
            placeholder="Digite a nova senha"
            error={resetErrors.newPassword?.message}
            registration={registerReset("newPassword")}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((current) => !current)}
          />

          <PasswordGuidelines password={newPassword} />

          <PasswordField
            label="Confirmar nova senha"
            placeholder="Digite a nova senha novamente"
            error={resetErrors.confirmNewPassword?.message}
            registration={registerReset("confirmNewPassword")}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((current) => !current)}
          />

          <Button
            type="submit"
            size="lg"
            isLoading={isResetting}
            variant="navy"
          >
            Redefinir senha
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(event) => void handleVerifySubmit(onVerifySubmit)(event)}
          className="space-y-5"
          noValidate
        >
          <p className="text-sm text-gray-600">
            Informe o e-mail da sua conta e o código recebido para continuar.
          </p>

          <AuthField
            label="E-mail"
            type="email"
            placeholder="seu.email@exemplo.com"
            icon={<Mail className="size-5" />}
            error={verifyErrors.email?.message}
            registration={registerVerify("email")}
          />

          <div className="space-y-2">
            <AuthField
              label="Código"
              type="text"
              placeholder="Ex.: 7KQ4-MX9T"
              icon={<KeyRound className="size-5" />}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              className="uppercase placeholder:normal-case"
              error={verifyErrors.code?.message}
              registration={registerVerify("code")}
            />

            {showRequestNewCodeLink && (
              <p className="text-sm">
                <Link
                  to="/forgot-password"
                  state={{ ...returnTo, email: currentEmail }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Pedir um novo código
                </Link>
              </p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            isLoading={isVerifying || isAutoVerifying}
            variant="navy"
          >
            Continuar
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
