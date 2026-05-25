import helpaWhiteLogo from "../assets/helpa-logo-white.svg";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between md:divide-x md:divide-slate-700/30 mb-8">
          {/* Logo e Descrição */}
          <div className="px-0 md:px-8 py-6 md:py-0 md:flex-1">
            <div className="flex items-start md:items-center gap-6">
              <img src={helpaWhiteLogo} alt="helpa" className="h-20 md:h-24 w-auto flex-shrink-0" />
              <p className="text-sm text-gray-300 max-w-md leading-relaxed">
                Plataforma de voluntariado universitário conectando estudantes, docentes e comunidade.
              </p>
            </div>
          </div>

          {/* Links Rápidos */}
          <div className="px-0 md:px-8 py-6 md:py-0 md:flex-1">
            <div className="pl-0 md:pl-8">
              <h4 className="font-semibold mb-4 text-white">Links Rápidos</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white transition">Home</a></li>
                <li><a href="#" className="hover:text-white transition">Sobre</a></li>
                <li><a href="#" className="hover:text-white transition">Oportunidades</a></li>
              </ul>
            </div>
          </div>

          {/* Contato */}
          <div className="px-0 md:px-8 py-6 md:py-0 md:flex-1">
            <div className="pl-0 md:pl-8">
              <h4 className="font-semibold mb-4 text-white">Contato</h4>
              <p className="text-sm text-gray-300">
                helpa@universidade.edu.br
              </p>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="pt-8">
          <p className="text-center text-sm text-gray-400">
            © 2026 helpa. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
