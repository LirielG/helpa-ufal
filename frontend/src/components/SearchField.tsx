import { Search } from "lucide-react";
import { Input } from "./Input";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the field, which carries no visible label. */
  label: string;
  placeholder?: string;
}

/**
 * Search box for a feed's filter bar. The `<form role="search">` is what makes
 * Enter submit instead of reloading the page, so it belongs here rather than in
 * `Input`, which every other kind of field also uses.
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: SearchFieldProps) {
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()}>
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        icon={<Search className="size-5" aria-hidden="true" />}
      />
    </form>
  );
}
