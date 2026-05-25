import type { ReactNode } from "react";
import { Layout } from "../../../components";

type AuthShellProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  cardClassName?: string;
};

export function AuthShell({
  children,
  header,
  footer,
  maxWidthClassName = "max-w-md",
  cardClassName = "",
}: AuthShellProps) {
  return (
    <Layout>
      <div className={`${maxWidthClassName} mx-auto`}>
        {header && <div className="mb-6">{header}</div>}

        <div className={`bg-white rounded-2xl shadow-xl p-8 ${cardClassName}`}>
          {children}
        </div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </Layout>
  );
}