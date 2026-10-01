import { useActionRegister } from "../../../hooks/useActionRegister";
import { useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";
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
  const location = useLocation();
  const  [wasCreated, setWasCreated] = useState(false);

  const { isOpen, closeRegisterModal, onSuccessCallback } = useActionRegister();

  const handleSuccess = () => {
    setWasCreated(true);

    if(onSuccessCallback){
      onSuccessCallback();
    }
  };

  const handleClose = () => {
    closeRegisterModal();

    if (wasCreated && location.pathname !== "/" && location.pathname !=="/dashboard"){
      navigate("/dashboard");
    }
    setWasCreated(false);
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
        isOpen = {isOpen}
        onClose = {handleClose}
        onSuccess = {handleSuccess}
      />
    </div>
  );
}
