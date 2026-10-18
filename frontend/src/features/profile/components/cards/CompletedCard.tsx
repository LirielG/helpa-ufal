import { useState } from "react";
import { MapPin, Calendar, CircleCheck, Download } from "lucide-react";
import { ApiError } from "@/services/apiError";
import { downloadCertificate } from "../../services";
import type { UserActivity } from "../../types";

const DOWNLOAD_ERROR_MESSAGE =
  "Não foi possível baixar o certificado. Tente novamente.";
const UNAVAILABLE_MESSAGE =
  "Este certificado não está mais disponível. Recarregue a página para ver a situação atual.";

/** The API stores the code without its hyphen; people read it as `XXXXX-XXXXX`. */
function formatValidationCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

// Some browsers ignore clicks on a detached anchor, and revoking the URL in the
// same tick can cancel the download before it reads the blob.
function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url));
}

export function CompletedCard({ activity }: { activity: UserActivity }) {
  const { certificate } = activity;
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // The API answers 404 once the attendance stops attesting presence (or the
  // certificate is otherwise out of reach), so offering a retry is pointless.
  const [isUnavailable, setIsUnavailable] = useState(false);

  // Once homologated, the hours that count are the confirmed ones, which can
  // be lower than what the action planned.
  const workloadLabel = certificate
    ? `${activity.confirmedWorkloadHours} horas homologadas`
    : activity.action.details?.workloadHours != null
      ? `${activity.action.details.workloadHours} horas`
      : null;

  const handleDownload = async () => {
    if (!certificate) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const blob = await downloadCertificate(certificate.id);
      // Built here rather than parsed from Content-Disposition, which the
      // browser only exposes to scripts when the API lists it as exposed.
      saveFile(blob, `certificado-${certificate.validationCode}.pdf`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setIsUnavailable(true);
        setDownloadError(UNAVAILABLE_MESSAGE);
      } else {
        setDownloadError(DOWNLOAD_ERROR_MESSAGE);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 transition-all hover:shadow-md flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CircleCheck className="size-6 shrink-0 text-white fill-[#3BB54A]" />
        <h4 className="font-bold text-gray-900 leading-snug">
          {activity.action.title}
        </h4>
      </div>
      <p className="text-sm text-gray-600">{activity.description}</p>

      <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
        <span className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-gray-400" />
          {activity.location}
        </span>
        <span className="flex items-center gap-2">
          <Calendar className="size-4 shrink-0 text-gray-400" />
          {activity.date}
        </span>
        {workloadLabel && (
          <span className="ml-auto bg-[#006300] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            {workloadLabel}
          </span>
        )}
      </div>

      {certificate && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-600">
              Código de validação:{" "}
              <span className="font-mono font-semibold text-gray-900">
                {formatValidationCode(certificate.validationCode)}
              </span>
            </p>
            {!isUnavailable && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#1B75BB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="size-4 shrink-0" />
                {isDownloading ? "Baixando..." : "Baixar certificado"}
              </button>
            )}
          </div>
          {downloadError && (
            <p role="alert" className="text-sm text-red-600">
              {downloadError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
