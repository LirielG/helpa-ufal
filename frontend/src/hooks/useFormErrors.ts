import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ValidationError } from "../validators";

export const useFormErrors = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addError = (field: string, message: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: message,
    }));
  };

  const clearError = (field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const clearAllErrors = () => {
    setErrors({});
  };

  const setErrorsFromArray = (validationErrors: ValidationError[]) => {
    const errorMap: Record<string, string> = {};
    validationErrors.forEach((error) => {
      errorMap[error.field] = error.message;
    });
    setErrors(errorMap);
  };

  return {
    errors,
    addError,
    clearError,
    clearAllErrors,
    setErrorsFromArray,
  };
};

export const useFormInput = (
  initialValue: string = ""
): [string, Dispatch<SetStateAction<string>>, () => void] => {
  const [value, setValue] = useState(initialValue);

  const reset = () => setValue(initialValue);

  return [value, setValue, reset];
};
