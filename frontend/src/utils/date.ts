export function formatDate(isoString?: string): string {
  if (!isoString) return "Data não definida";

  return new Date(isoString).toLocaleDateString("pt-BR");
}

export function formatTime(isoString?: string): string {
  if (!isoString) return "";

  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toInputDate(isoString?: string): string {
  if (!isoString) return "";

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromInputDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
