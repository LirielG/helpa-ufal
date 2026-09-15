import CustomError from "@/models/error/CustomError.js";

export type ValidationErrorItem = {
  field:   string;
  message: string;
};

class ValidationError extends CustomError {
  private _errors: ValidationErrorItem[];

  constructor(errors: ValidationErrorItem[], message = "Validation error.") {
    super(400, message);
    this._errors = errors;
  }

  public get errors(): ValidationErrorItem[] {
    return this._errors;
  }
}

export default ValidationError;