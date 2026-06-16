import { Eye, Download, FileText } from "lucide-react";

interface Certificate {
  id: string;
  actionTitle: string;
  institution: string;
  hours: number;
  completionDate: string;
  emissionDate: string;
  code: string;
  imageUrl: string;
}

const mockCertificates: Certificate[] = [
  {
    id: "1",
    actionTitle: "Mutirão de Saúde Comunitária 2025",
    institution: "UFPB",
    hours: 20,
    completionDate: "14/03/2026",
    emissionDate: "19/03/2026",
    code: "CERT-2026-001",
    imageUrl:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "2",
    actionTitle: "Oficina de Teatro na Comunidade",
    institution: "UFRN",
    hours: 16,
    completionDate: "19/02/2026",
    emissionDate: "24/02/2026",
    code: "CERT-2026-002",
    imageUrl:
      "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "3",
    actionTitle: "Alfabetização Digital para Idosos",
    institution: "UFRN",
    hours: 24,
    completionDate: "09/01/2026",
    emissionDate: "14/01/2026",
    code: "CERT-2026-003",
    imageUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "4",
    actionTitle: "Projeto de Reflorestamento Urbano",
    institution: "UFPE",
    hours: 18,
    completionDate: "22/11/2025",
    emissionDate: "27/11/2025",
    code: "CERT-2026-004",
    imageUrl:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=400&q=80",
  },
];

export function CertificatesList() {
  const handleView = (id: string) => {
    console.log(`Visualizando certificado ${id}`);
  };

  const handleDownloadMock = (title: string) => {
    console.log(`Download iniciado para o certificado:\n"${title}"`);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-800">Meus Certificados</h3>

      <div className="w-full flex items-start gap-6 overflow-x-auto pb-4 px-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {mockCertificates.map((cert) => (
          <div
            key={cert.id}
            className="flex-none w-[280px] min-h-[380px] bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-md mb-2"
          >
            <div className="relative h-32 bg-gray-100 flex-none">
              <img
                src={cert.imageUrl}
                alt={cert.actionTitle}
                className="w-full h-full object-cover"
              />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-blue-50 border-2 border-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="pt-7 px-4 pb-4 text-center flex-1 flex flex-col justify-between gap-4">
              <div>
                <h4 className="font-bold text-gray-800 text-sm line-clamp-2 leading-snug">
                  {cert.actionTitle}
                </h4>
                <p className="text-[11px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">
                  {cert.institution}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {cert.hours} horas - {cert.completionDate}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 space-y-3 flex-none">
                <p className="text-[11px] text-gray-400">
                  Emitido em {cert.emissionDate}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleView(cert.id)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-[#000E1D] bg-[#CCE8FF] hover:bg-[#b3dcfc] rounded-xl transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Visualizar
                  </button>
                  <button
                    onClick={() => handleDownloadMock(cert.actionTitle)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>

                <span className="block text-[10px] font-mono text-gray-400 tracking-widest uppercase">
                  {cert.code}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
