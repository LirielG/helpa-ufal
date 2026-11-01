import { Link } from "react-router";

type AuthFooterLinkProps = {
  prefix: string;
  linkText: string;
  to: string;
  state?: unknown;
};

export function AuthFooterLink({
  prefix,
  linkText,
  to,
  state,
}: AuthFooterLinkProps) {
  return (
    <p className="text-gray-600 text-center">
      {prefix}{" "}
      <Link
        to={to}
        state={state}
        className="text-blue-600 hover:text-blue-700 font-medium"
      >
        {linkText}
      </Link>
    </p>
  );
}
