import { Link } from "react-router";
import { HEADER_LABELS } from "@/features/dashboard/constants";
import { useAuth } from "@/hooks";

interface HomeLogoLinkProps {
  src: string;
  imageClassName: string;
}

export function HomeLogoLink({ src, imageClassName }: HomeLogoLinkProps) {
  const { isAuthenticated } = useAuth();

  return (
    <Link
      to={isAuthenticated ? "/dashboard" : "/"}
      aria-label={HEADER_LABELS.homeAriaLabel}
      className="inline-flex shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00579A]"
    >
      <img src={src} alt="helpa" className={imageClassName} />
    </Link>
  );
}