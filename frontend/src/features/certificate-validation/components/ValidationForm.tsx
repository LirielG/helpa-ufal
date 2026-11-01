import { useState, type FormEvent } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

interface ValidationFormProps {
  initialCode: string;
  isLoading: boolean;
  /** Receives the code without the surrounding spaces; never an empty one. */
  onSubmit: (code: string) => void;
}

export function ValidationForm({
  initialCode,
  isLoading,
  onSubmit,
}: ValidationFormProps) {
  const [code, setCode] = useState(initialCode);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = code.trim();
    if (!trimmed || isLoading) return;

    onSubmit(trimmed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row sm:items-end gap-3"
      noValidate
    >
      <div className="flex-1">
        <Input
          label="Código de validação"
          name="validationCode"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Ex.: 7KQ4M-X9T2R"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </div>
      <Button type="submit" disabled={isLoading} className="sm:px-8">
        Validar
      </Button>
    </form>
  );
}
