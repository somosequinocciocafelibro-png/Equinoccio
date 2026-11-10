/** Error de regla de negocio con un código estable que la interfaz traduce a texto. */
export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
  }
}
