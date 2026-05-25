import CustomError from "@/models/error/CustomError.js";

export type ValidationErrorItem = {
  field:   string;
  message: string;
};

class ValidationError extends CustomError {
  private _errors: ValidationErrorItem[];

  constructor(errors: ValidationErrorItem[]) {
    super(400, "Validation error.");
    this._errors = errors;
  }

  public get errors(): ValidationErrorItem[] {
    return this._errors;
  }
}

export default ValidationError;