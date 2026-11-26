import { Link } from "react-router";
import helpaWhiteLogo from "../assets/helpa-logo-white.svg";
import { useAuth } from "../hooks/useAuth";

export function Footer() {
  const { isAuthenticated } = useAuth();

  const quickLinks = isAuthenticated
    ? [
        { label: "Ações", to: "/dashboard" },
        { label: "Meu perfil", to: "/profile" },
        { label: "Validar certificado", to: "/validate" },
      ]
    : [
        { label: "Sobre o projeto", to: "/" },
        { label: "Entrar", to: "/login" },
        { label: "Criar conta", to: "/register" },
        { label: "Validar certificado", to: "/validate" },
      ];

  return (
    <footer className="bg-[#002147] text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between md:divide-x md:divide-white/20 mb-8">
          <div className="px-0 md:px-8 py-6 md:py-0 md:flex-1">
            <div className="flex items-start md:items-center gap-6">
              <img
                src={helpaWhiteLogo}
                alt="helpa"
                className="h-20 md:h-24 w-auto flex-shrink-0"
              />
              <p className="text-sm text-gray-300 max-w-md leading-relaxed">
                Plataforma de voluntariado universitário conectando estudantes,
                docentes e comunidade.
              </p>
            </div>
          </div>

          <div className="px-0 md:px-8 py-6 md:py-0 md:flex-1">
            <div className="pl-0 md:pl-8">
              <h4 className="font-semibold mb-4 text-white">Links Rápidos</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                {quickLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="hover:text-white transition">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-8">
          <p className="text-center text-sm text-gray-400">
            © 2026 helpa. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
