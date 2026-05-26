import type { ReactNode } from "react";

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
  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={containerStyle}>
      {header && <header>{header}</header>}

      <main className="flex-1 flex flex-col w-full">
        {children}
      </main>

      {footer && <footer>{footer}</footer>}
    </div>
  );
}