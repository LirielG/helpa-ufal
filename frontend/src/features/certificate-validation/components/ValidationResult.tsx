import { BadgeCheck, SearchX } from "lucide-react";
import { Button } from "@/components/Button";
import { formatDate } from "@/utils/date";
import type { CertificateValidation } from "@/services/contracts/certificate";
import type { ValidationState } from "../useCertificateValidation";
import {
  formatPeriod,
  formatValidationCode,
  formatWorkloadHours,
} from "../format";

interface ValidationResultProps {
  state: ValidationState;
  onRetry: () => void;
}

export function ValidationResult({ state, onRetry }: ValidationResultProps) {
  switch (state.status) {
    case "idle":
      return null;

    case "loading":
      return (
        <p className="text-gray-500 text-center py-8">
          Consultando certificado…
        </p>
      );

    case "found":
      return <AuthenticCertificate certificate={state.certificate} />;

    // Covers typos and certificates that stopped counting after a presence
    // correction, so the copy must not suggest the document is forged.
    case "notFound":
      return (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-center gap-3">
            <SearchX className="size-6 shrink-0" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Código não encontrado</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            Confira se o código foi digitado exatamente como aparece no
            certificado. Se estiver correto, este código não corresponde a um
            certificado válido no momento: um certificado deixa de constar aqui
            quando o registro de presença que o originou é corrigido.
          </p>
        </section>
      );

    case "failed":
      return (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 space-y-4">
          <p>
            Não foi possível consultar o certificado agora. Tente novamente em
            instantes.
          </p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        </section>
      );
  }
}

function AuthenticCertificate({
  certificate,
}: {
  certificate: CertificateValidation;
}) {
  const rows = [
    { label: "Titular", value: certificate.holderName },
    { label: "Ação", value: certificate.activityTitle },
    {
      label: "Período",
      value: formatPeriod(
        certificate.activityStartDate,
        certificate.activityEndDate,
      ),
    },
    {
      label: "Carga horária",
      value: formatWorkloadHours(certificate.workloadHours),
    },
    { label: "Emitido em", value: formatDate(certificate.issuedAt) },
    {
      label: "Código",
      value: formatValidationCode(certificate.validationCode),
      mono: true,
    },
  ];

  return (
    <section className="rounded-xl border border-green-200 bg-green-50 p-6">
      <div className="flex items-center gap-3 text-green-800">
        <BadgeCheck className="size-7 shrink-0" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Certificado autêntico</h2>
      </div>
      <p className="mt-1 text-sm text-green-900">
        Este código corresponde a um certificado emitido pela HELPA.
      </p>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {rows.map(({ label, value, mono }) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {label}
            </dt>
            <dd
              className={`mt-1 text-gray-900 ${mono ? "font-mono tracking-wider" : "font-medium"}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* A later issue date means a reissue after an hours correction. */}
      <p className="mt-5 border-t border-green-200 pt-4 text-sm text-gray-600">
        Se a data de emissão for posterior à do documento em mãos, o certificado
        foi reemitido. Os dados exibidos são os vigentes e prevalecem sobre o
        documento impresso.
      </p>
    </section>
  );
}
