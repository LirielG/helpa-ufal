export const cn = (
  ...classes: (string | undefined | null | false)[]
): string => {
  return classes.filter(Boolean).join(" ");
};

export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function getInitials(name?: string | null): string {
  if (!name) return "";
  
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);

  if (words.length === 0) return "";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();

  const filteredWords = words.filter((w, index) => index === 0 || index === words.length - 1 || !["de", "da", "do", "dos", "das", "e"].includes(w.toLowerCase()));

  const firstInitial = filteredWords[0][0];
  const lastInitial = filteredWords[filteredWords.length - 1][0];

  return `${firstInitial}${lastInitial}`.toUpperCase();
}