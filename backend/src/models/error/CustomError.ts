class CustomError extends Error {
  private _statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this._statusCode = statusCode;
  }

  public get statusCode(): number {
    return this._statusCode;
  }
}

export default CustomError;
