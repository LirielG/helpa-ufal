export function Footer() {
  return (
    <footer className="bg-slate-900 text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Logo e Descrição */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="size-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-slate-900 font-bold text-sm">H</span>
              </div>
              <span className="text-xl font-bold">helpa</span>
            </div>
            <p className="text-sm text-gray-400">
              Plataforma de voluntariado universitário conectando estudantes, docentes e comunidade.
            </p>
          </div>

          {/* Links Rápidos */}
          <div>
            <h4 className="font-semibold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition">Home</a></li>
              <li><a href="#" className="hover:text-white transition">Sobre</a></li>
              <li><a href="#" className="hover:text-white transition">Oportunidades</a></li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-semibold mb-4">Contato</h4>
            <p className="text-sm text-gray-400">
              helpa@universidade.edu.br
            </p>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-gray-700 pt-8">
          <p className="text-center text-sm text-gray-400">
            © 2026 helpa. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
