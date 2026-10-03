import { useActionRegister } from "../../../hooks/useActionRegister";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ActionRegister } from "./ActionForm";

type DashboardShellProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  containerStyle?: React.CSSProperties;
};

export function DashboardShell({
  children,
  header,
  footer,
  containerStyle,
}: DashboardShellProps) {
  const navigate = useNavigate();
  const [wasCreated, setWasCreated] = useState(false);

  const { isOpen, closeRegisterModal, onSuccessCallback } = useActionRegister();

  useEffect(() => closeRegisterModal, [closeRegisterModal]);

  const handleSuccess = () => {
    setWasCreated(true);

    if (onSuccessCallback) {
      onSuccessCallback();
    }
  };

  const handleClose = () => {
    const shouldGoToFeed = wasCreated && !onSuccessCallback;
    closeRegisterModal();
    setWasCreated(false);

    if (shouldGoToFeed) {
      navigate("/dashboard");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-50"
      style={containerStyle}
    >
      {header && <header>{header}</header>}

      <main className="flex flex-col w-full">{children}</main>

      {footer && <footer>{footer}</footer>}

      <ActionRegister
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
