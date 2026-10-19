import { useParams } from "react-router";
import { Footer } from "@/components/Footer";
import helpaBlueLogo from "@/assets/helpa-logo-blue-text.svg";
import { ValidationPanel } from "@/features/certificate-validation/components/ValidationPanel";

/**
 * Public page where whoever received a HELPA certificate checks it, reached
 * from the printed QR code (`/validar/<code>`) or by typing the printed
 * address (`/validar`). Both paths are printed on issued PDFs, so they can
 * never change.
 *
 * The readers have no account and are checking someone else's document, so
 * the page shows nothing tied to a session (no Navbar: it links to the
 * profile) and behaves the same for visitors and signed-in users.
 */
export function CertificateValidation() {
  const { validationCode = "" } = useParams<{ validationCode: string }>();
  // Trimmed like a typed code, so a link copied with a stray space behaves
  // the same as typing it.
  const code = validationCode.trim();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <img
            src={helpaBlueLogo}
            alt="helpa"
            className="h-10 md:h-12 w-auto"
          />
        </div>
      </header>

      <main className="flex-1 py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Validar certificado
            </h1>
            <p className="mt-2 text-gray-600">
              Digite o código impresso no certificado para confirmar se ele é
              autêntico e ver as horas que ele atesta.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            {/* Remounted per code: the field and the answer always match the URL. */}
            <ValidationPanel key={code} code={code} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
