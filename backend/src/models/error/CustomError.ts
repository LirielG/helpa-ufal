import {
  GENERIC_ERROR_CODES,
  type ErrorCode,
  type ErrorDetails,
  type ErrorStatus,
} from "@/models/error/ErrorCodes.js";

export type CustomErrorOptions = {
  code?: ErrorCode;
  details?: ErrorDetails;
};

class CustomError extends Error {
  private _statusCode: ErrorStatus;
  private _code: ErrorCode;
  private _details: ErrorDetails | undefined;

  constructor(
    statusCode: ErrorStatus,
    message: string,
    options: CustomErrorOptions = {},
  ) {
    super(message);
    this._statusCode = statusCode;
    this._code = options.code ?? GENERIC_ERROR_CODES[statusCode];
    this._details = options.details;
  }

  public get statusCode(): ErrorStatus {
    return this._statusCode;
  }

  public get code(): ErrorCode {
    return this._code;
  }

  public get details(): ErrorDetails | undefined {
    return this._details;
  }
}

export default CustomError;
