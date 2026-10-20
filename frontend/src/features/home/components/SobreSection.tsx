import {
  ArrowDown,
  Compass,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  ClipboardCheck,
} from "lucide-react";
import { useNavigate } from "react-router";

const NARRATIVE_ITEMS = [
  {
    id: "contexto",
    eyebrow: "Contexto Real da Universidade",
    eyebrowColor: "text-[#00579A]",
    iconBg: "bg-[#D6E3FF]",
    iconColor: "text-[#000A1E]",
    Icon: Compass,
    title: "Vivência prática no Campus Arapiraca",
    description:
      "O Helpa nasceu do nosso cotidiano na UFAL Arapiraca para descomplicar a extensão universitária. Ele atua como uma ponte ágil e moderna entre os estudantes e as ações da universidade, oferecendo uma experiência de busca muito mais simples e intuitiva para substituir a lentidão e a complexidade de sistemas tradicionais, como o SIGAA.",
  },
  {
    id: "desafio",
    eyebrow: "O Desafio",
    eyebrowColor: "text-[#BA1A1A]",
    iconBg: "bg-[#FFDAD6]",
    iconColor: "text-[#93000A]",
    Icon: AlertTriangle,
    title: "Dispersão e perda de iniciativas transformadoras",
    description:
      "Projetos consolidados e essenciais do campus — a exemplo do Projeto Katie (voltado ao estímulo e inclusão de meninas na tecnologia) — enfrentava sérias barreiras de divulgação. Vagas de voluntariado e oficinas ficavam restritas a grupos fechados de WhatsApp, stories temporários de redes sociais e formulários avulsos do Google, gerando retrabalho, perda de dados e exclusão de potenciais voluntários.",
  },
  {
    id: "solucao",
    eyebrow: "A Resposta Institucional",
    eyebrowColor: "text-[#1D4ED8]",
    iconBg: "bg-[#DCE1FF]",
    iconColor: "text-[#1D4ED8]",
    Icon: CheckCircle2,
    title: "A Solução Centralizadora e Integrada",
    description:
      "O Helpa estabelece um ambiente acadêmico padronizado. Organizadores publicam suas demandas com clareza, e estudantes encontram oportunidades através de filtros eficientes. Assim, a universidade ganha um espaço integrado que potencializa a participação dos alunos e fortalece a extensão universitária de forma organizada.",
  },
] as const;

const AUDIENCE_BLOCKS = [
  {
    id: "estudantes",
    title: "Para Estudantes de Graduação (Todos os Cursos)",
    description:
      "Encontre projetos alinhados aos seus interesses pessoais e acadêmicos, acumule horas formativas auditáveis e transforme teoria acadêmica em impacto social direto. Visualize seu progresso curricular, candidate-se com um clique e receba certificações validadas pelos coordenadores responsáveis.",
    iconBg: "bg-[#002147]",
    iconColor: "text-white",
    Icon: GraduationCap,
  },
  {
    id: "coordenadores",
    title: "Para Coordenadores e Docentes",
    description:
      "Acabe com triagens manuais em planilhas dispersas e formulários frágeis. Cadastre minicursos, palestras, workshops e eventos com controle unificado de inscritos, presença e emissão facilitada de dados.",
    iconBg: "bg-[#D6E3FF]",
    iconColor: "text-[#000A1E]",
    Icon: ClipboardCheck,
  },
] as const;

export function SobreSection() {
  const navigate = useNavigate();

  const scrollToOrigin = () => {
    const element = document.getElementById("como-nasceu");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      id="sobre"
      className="w-full scroll-mt-16 sm:scroll-mt-20 md:scroll-mt-[102px]"
    >
      <section className="relative overflow-hidden bg-[linear-gradient(92.99deg,#00579A_62.85%,#001D34_107.12%)] py-12 sm:py-16 md:py-20 px-4 sm:px-6 md:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 top-6 w-[200px] sm:w-[235px] h-[200px] sm:h-[224px] rounded-full bg-white/25 blur-[50px]"
        />

        <div className="max-w-[1200px] mx-auto relative z-10 flex flex-col items-start gap-6">
          <div className="flex flex-col gap-3 max-w-[768px]">
            <h1 className="text-2xl sm:text-4xl md:text-[48px] leading-tight md:leading-[58px] font-bold tracking-[-0.8px] md:tracking-[-1.2px] text-white">
              Helpa: Hub Estudantil de Laços, Participação e Ação.
            </h1>

            <p className="text-sm sm:text-base md:text-[18px] leading-relaxed md:leading-[29px] font-normal text-[#D6E3FF] max-w-[672px]">
              A plataforma oficial para unir demandas sociais, projetos de
              extensão da UFAL e estudantes voluntários de todos os cursos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto pt-1">
            <button
              type="button"
              onClick={scrollToOrigin}
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 sm:py-3 rounded-lg bg-[#002147] text-white text-[14px] leading-[17px] font-semibold tracking-[0.7px] shadow-md hover:bg-[#001630] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>Conhecer o Projeto</span>
              <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/register")}
              className="inline-flex items-center justify-center px-6 py-3.5 sm:py-3 rounded-lg bg-white text-[#000A1E] text-[14px] leading-[17px] font-semibold tracking-[0.7px] shadow-sm hover:bg-[#F2F4F6] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Fazer Cadastro para Voluntariar
            </button>
          </div>
        </div>
      </section>

      <section
        id="como-nasceu"
        className="relative overflow-hidden bg-[#F2F4F6] py-12 sm:py-16 md:pt-10 md:pb-20 px-4 sm:px-6 md:px-10 scroll-mt-16 sm:scroll-mt-20 md:scroll-mt-[102px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 w-[200px] sm:w-[265px] h-[220px] sm:h-[282px] rounded-full bg-gradient-to-bl from-white/20 to-[#1D4ED8]/20 blur-[32px]"
        />

        <div className="max-w-[1200px] mx-auto px-0 md:px-6 relative z-10 flex flex-col gap-8 sm:gap-10">
          <div className="flex flex-col gap-1.5 max-w-[672px]">
            <span className="text-xs sm:text-[14px] leading-[17px] font-semibold tracking-[0.7px] uppercase text-[#00579A]">
              SOBRE NÓS
            </span>
            <h2 className="text-xl sm:text-2xl md:text-[32px] leading-snug md:leading-[42px] font-semibold tracking-[-0.5px] md:tracking-[-0.8px] text-[#000A1E]">
              Como Nasceu o Helpa e Por Que Ele Existe
            </h2>
          </div>

          <div className="flex flex-col gap-8 sm:gap-10">
            {NARRATIVE_ITEMS.map(
              ({
                id,
                eyebrow,
                eyebrowColor,
                iconBg,
                iconColor,
                Icon,
                title,
                description,
              }) => (
                <article
                  key={id}
                  className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 max-w-[1024px]"
                >
                  <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-lg ${iconBg} flex items-center justify-center shrink-0 shadow-xs`}
                  >
                    <Icon className={`size-5 ${iconColor}`} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span
                      className={`text-xs sm:text-[14px] leading-[17px] font-semibold tracking-[0.7px] ${eyebrowColor}`}
                    >
                      {eyebrow}
                    </span>
                    <h3 className="text-lg sm:text-xl md:text-[24px] leading-snug md:leading-[34px] font-semibold text-[#000A1E]">
                      {title}
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed sm:leading-[26px] text-[#1E1E1E] mt-1">
                      {description}
                    </p>
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[radial-gradient(74.86%_315.49%_at_93.98%_84.98%,#002147_0%,#0050AD_100%)] py-12 sm:py-16 md:pt-12 md:pb-20 px-4 sm:px-6 md:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none hidden sm:block absolute -right-24 top-16 w-72 h-72 rounded-full border border-white/80"
        />

        <div className="max-w-[1200px] mx-auto px-0 md:px-6 relative z-10 flex flex-col gap-8 sm:gap-12">
          <div className="flex flex-col gap-2 max-w-[672px]">
            <span className="text-xs sm:text-[14px] leading-[17px] font-semibold tracking-[0.7px] uppercase text-white">
              PÚBLICO-ALVO E BENEFÍCIOS
            </span>
            <h2 className="text-xl sm:text-2xl md:text-[32px] leading-snug md:leading-[42px] font-semibold tracking-[-0.5px] md:tracking-[-0.8px] text-white">
              Para Quem é o Helpa?
            </h2>
            <p className="text-sm sm:text-base leading-relaxed sm:leading-6 text-[#D6E3FF]">
              Uma infraestrutura concebida para atender os três pilares que
              movem a extensão universitária na UFAL.
            </p>
          </div>

          <div className="flex flex-col gap-5 sm:gap-6 max-w-[1152px]">
            {AUDIENCE_BLOCKS.map(
              ({ id, title, description, iconBg, iconColor, Icon }) => (
                <div
                  key={id}
                  className="bg-white rounded-xl shadow-xs p-5 sm:p-6 md:px-12 md:py-6 flex flex-col sm:flex-row items-start gap-4 sm:gap-6 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                >
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`size-6 ${iconColor}`} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg sm:text-xl md:text-[24px] leading-snug md:leading-[34px] font-semibold text-[#000A1E]">
                      {title}
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed sm:leading-[26px] text-[#44474E]">
                      {description}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
