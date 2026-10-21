import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import mockupHelpa from "../../../assets/mockup-helpa.png";
import mockupSigaa from "../../../assets/mockup-sigaa.png";

interface HowItWorksSectionProps {
  onExploreActions?: () => void;
}

export function HowItWorksSection({
  onExploreActions,
}: HowItWorksSectionProps) {
  return (
    <div className="w-full">
      <section className="relative overflow-hidden bg-[linear-gradient(92.87deg,#00579A_18.7%,#001D34_85.37%)] py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-16 text-white">
        <div className="max-w-[1200px] mx-auto relative z-10 flex flex-col gap-8 md:gap-14">
          <div className="max-w-[768px] flex flex-col gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-[48px] leading-tight font-bold tracking-tight">
              Como o Helpa Funciona?
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-[#E6E8EA] leading-relaxed">
              Nossa plataforma conecta você a duas formas complementares de
              participar e transformar a comunidade acadêmica da UFAL. Escolha
              como quer explorar as oportunidades:
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between sm:justify-start sm:gap-24 md:gap-32 pt-6 border-t border-white/15 w-full max-w-[900px] text-center">
            <div className="flex flex-col gap-0.5 mb-6 sm:mb-0">
              <p className="text-2xl sm:text-3xl font-bold">100%</p>
              <span className="text-[10px] sm:text-xs uppercase tracking-wider text-[#D6E3FF]">
                Gratuito e Acadêmico
              </span>
            </div>
            
            <div className="flex flex-col gap-0.5 mb-6 sm:mb-0">
              <p className="text-2xl sm:text-3xl font-bold">2 Modos</p>
              <span className="text-[10px] sm:text-xs uppercase tracking-wider text-[#D6E3FF]">
                Helpa Nativo + SIGAA
              </span>
            </div>
            
            <div className="flex flex-col gap-0.5">
              <p className="text-2xl sm:text-3xl font-bold">Horas Complementares</p>
              <span className="text-[10px] sm:text-xs uppercase tracking-wider text-[#D6E3FF]">
                Certificados
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F7F9FB] py-12 sm:py-16 px-4 sm:px-6 md:px-12">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-8 sm:gap-12">
          <div>
            <span className="text-xs font-semibold text-[#1D4ED8] uppercase tracking-wider">
              Arquitetura de Abas
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#002147] mt-1">
              Compare as duas abas do Feed
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mt-1">
              No HELPA temos duas abas para fácil acesso de ações na
              universidade.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden transition-shadow hover:shadow-xl">
              <div className="bg-[#00579A]/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-white text-[10px] sm:text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 sm:size-3 rounded-full bg-red-500/80 inline-block shrink-0" />
                  <span className="size-2.5 sm:size-3 rounded-full bg-[#002147] inline-block shrink-0" />
                  <span className="size-2.5 sm:size-3 rounded-full bg-gray-300 inline-block shrink-0" />
                  <span className="ml-1 sm:ml-2 text-white/90 truncate max-w-[150px] sm:max-w-none">
                    helpa.ufal.br/dashboard
                  </span>
                </div>
                <span className="bg-[#DCE1FF] text-[#001551] px-2 py-0.5 rounded font-sans font-bold tracking-wider uppercase shrink-0">
                  Plataforma Nativa
                </span>
              </div>

              <div className="w-full bg-gray-50 border-b border-gray-100 flex justify-center p-4">
                <img
                  src={mockupHelpa}
                  alt="Interface da aba Helpa"
                  className="w-full max-w-[500px] h-auto rounded shadow-sm object-cover"
                />
              </div>

              <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-6 flex-1 justify-between">
                <div className="flex flex-col gap-4">
                  <span className="text-xs font-bold text-[#1D4ED8] uppercase tracking-wider">
                    Aba 01
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#002147]">
                    Ações do Helpa
                  </h3>
                  <p className="text-sm font-medium text-gray-700">
                    Criadas e Gerenciadas por Nossa Comunidade
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Atividades de extensão, oficinas e voluntariado cadastradas
                    diretamente na nossa plataforma. Aqui qualquer discente ou
                    docente credenciado pode tanto se voluntariar quanto
                    cadastrar seu próprio projeto de impacto.
                  </p>

                  <ul className="space-y-3 sm:space-y-2.5 text-sm text-gray-700 pt-2">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                      <span>
                        Inscrição com 1 clique usando seus dados acadêmicos
                        salvos.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                      <span>
                        Painel completo para quem cria: controle presenças,
                        turnos e vagas.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                      <span>
                        Validação e emissão de certificados após conclusão da
                        ação.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6 border-t border-gray-100 flex flex-wrap gap-2">
                  <span className="bg-[#DCE1FF] text-[#001551] text-xs font-medium px-3 py-1 rounded-md">
                    Criação de Ações
                  </span>
                  <span className="bg-[#DCE1FF] text-[#001551] text-xs font-medium px-3 py-1 rounded-md">
                    Inscrição Direta
                  </span>
                  <span className="bg-[#DCE1FF] text-[#001551] text-xs font-medium px-3 py-1 rounded-md">
                    Gestão de Voluntários
                  </span>
                  <span className="bg-[#DCE1FF] text-[#001551] text-xs font-medium px-3 py-1 rounded-md">
                    Certificados Digitais
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col overflow-hidden transition-shadow hover:shadow-xl">
              <div className="bg-[#00579A]/90 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-white text-[10px] sm:text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 sm:size-3 rounded-full bg-red-500/80 inline-block shrink-0" />
                  <span className="size-2.5 sm:size-3 rounded-full bg-[#002147] inline-block shrink-0" />
                  <span className="size-2.5 sm:size-3 rounded-full bg-gray-300 inline-block shrink-0" />
                  <span className="ml-1 sm:ml-2 text-white/90 truncate max-w-[150px] sm:max-w-none">
                    helpa.ufal.br/dashboard?feed=sigaa
                  </span>
                </div>
                <span className="bg-[#D6E3FF] text-[#001B3D] px-2 py-0.5 rounded font-sans font-bold tracking-wider uppercase shrink-0">
                  Sincronização SIGAA
                </span>
              </div>

              <div className="w-full bg-gray-50 border-b border-gray-100 flex justify-center p-4">
                <img
                  src={mockupSigaa}
                  alt="Interface da aba SIGAA"
                  className="w-full max-w-[500px] h-auto rounded shadow-sm object-cover"
                />
              </div>

              <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-6 flex-1 justify-between">
                <div className="flex flex-col gap-4">
                  <span className="text-xs font-bold text-[#1D4ED8] uppercase tracking-wider">
                    Aba 02
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#002147]">
                    Ações do SIGAA
                  </h3>
                  <p className="text-sm font-medium text-gray-700">
                    Importadas do SIGAA Eventos & Extensão
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Consumimos diretamente os dados públicos do SIGAA para que
                    você tenha visibilidade completa de minicursos, eventos,
                    oficinas etc sem precisar navegar pela interface legada.
                  </p>

                  <ul className="space-y-3 sm:space-y-2.5 text-sm text-gray-700 pt-2">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                      <span>
                        Busca e filtros rápidos por palavras-chave, tipo e
                        departamento.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                      <span>
                        Atualização contínua com os registros oficiais
                        institucionais da UFAL.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                      <span>
                        Redirecionamento seguro para a página de inscrição final
                        no SIGAA.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col gap-4 pt-4 border-t border-gray-100 lg:border-t-0 lg:pt-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-[#DCE1FF] text-[#001551] text-xs font-medium px-3 py-1 rounded-md">
                      Busca centralizada
                    </span>
                    <span className="bg-[#DCE1FF] text-[#001551] text-xs font-medium px-3 py-1 rounded-md">
                      Dados oficiais da UFAL
                    </span>
                    <span className="bg-[#DCE1FF] text-[#001551] text-xs font-medium px-3 py-1 rounded-md">
                      Redirecionamento para o SIGAA
                    </span>
                  </div>

                  <div className="bg-[#ECEEF0] p-4 sm:p-3 rounded-lg flex items-start gap-3">
                    <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-800 font-medium leading-relaxed">
                      <strong>Importante:</strong> As inscrições nos eventos
                      desta aba são operadas externamente pelos servidores do
                      SIGAA. O Helpa atua como agregador inteligente de
                      descoberta.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F2F4F6] py-12 sm:py-16 px-4 sm:px-6 md:px-12">
        <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-10 sm:gap-12 text-center">
          <div className="max-w-[672px] flex flex-col items-center gap-2">
            <span className="text-xs font-semibold text-[#1D4ED8] uppercase tracking-wider">
              Passo a Passo Rápido
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#002147]">
              Como se envolver em 3 etapas
            </h2>
            <p className="text-gray-600 text-sm sm:text-base px-4">
              Do login à contabilização de suas horas complementares sem
              burocracia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full text-left">
            <div className="bg-[#002147] text-white p-6 sm:p-8 rounded-2xl shadow-md flex flex-col gap-4 transition-transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-[#00579A] flex items-center justify-center font-bold text-xl shrink-0">
                01
              </div>
              <h3 className="text-xl font-semibold">Explore o Feed Unificado</h3>
              <p className="text-sm text-gray-200 leading-relaxed">
                Navegue entre as abas Helpa e SIGAA. Utilize os filtros por
                área de atuação, tipo de ação e status.
              </p>
            </div>

            <div className="bg-[#002147] text-white p-6 sm:p-8 rounded-2xl shadow-md flex flex-col gap-4 transition-transform hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-[#00579A] flex items-center justify-center font-bold text-xl shrink-0">
                02
              </div>
              <h3 className="text-xl font-semibold">Inscreva-se ou Crie</h3>
              <p className="text-sm text-gray-200 leading-relaxed">
                Candidate-se a vagas voluntárias com confirmação instantânea no
                Helpa, ou clique em cadastrar ação para liderar uma equipe
                acadêmica comunitária.
              </p>
            </div>

            <div className="bg-[#002147] text-white p-6 sm:p-8 rounded-2xl shadow-md flex flex-col gap-4 transition-transform hover:-translate-y-1 sm:col-span-2 md:col-span-1">
              <div className="w-12 h-12 rounded-lg bg-[#00579A] flex items-center justify-center font-bold text-xl shrink-0">
                03
              </div>
              <h3 className="text-xl font-semibold">Conquiste Certificados</h3>
              <p className="text-sm text-gray-200 leading-relaxed">
                Finalize sua participação, receba o feedback do coordenador da
                ação e emita seu comprovante digital autenticado para validação na
                coordenação.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F7F9FB] py-12 sm:py-16 px-4 flex justify-center">
        <div className="bg-white max-w-[1200px] w-full rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 md:p-12 flex flex-col items-center text-center gap-6 relative overflow-hidden">
          <span className="text-xs font-semibold tracking-widest text-[#1D4ED8] uppercase">
            Comece a explorar agora mesmo
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#002147] max-w-xl">
            Pronto para transformar sua jornada na universidade?
          </h2>
          <button
            type="button"
            onClick={onExploreActions}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-[#1D4ED8] text-white font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2"
          >
            <span>Ir para o Feed de Ações</span>
            <ArrowRight className="size-5 shrink-0" />
          </button>
        </div>
      </section>
    </div>
  );
}
