export function getWorkloadLabel(hours: number): string {
  return hours === 1 ? "hora" : "horas";
}

export function formatWorkloadHours(hours: number): string {
  return `${hours} ${getWorkloadLabel(hours)}`;
}

export function formatHomologatedWorkloadHours(hours: number): string {
  const suffix = hours === 1 ? "homologada" : "homologadas";
  return `${formatWorkloadHours(hours)} ${suffix}`;
}
