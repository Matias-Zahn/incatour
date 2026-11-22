export class CustomError extends Error {
  private constructor(
    public message: string,
    public statusCode: number,
    public detalle?: unknown, // decisión 1 del contrato: datos para que el front arme el mensaje ({ error, detalle })
  ) {
    super(message);
  }

  public static badRequest(message: string, detalle?: unknown) {
    return new CustomError(message, 400, detalle);
  }

  public static unauthorized(message: string) {
    return new CustomError(message, 401);
  }
  public static forbidden(message: string) {
    return new CustomError(message, 403);
  }

  public static conflict(message: string, detalle?: unknown) {
    return new CustomError(message, 409, detalle);
  }

  public static notFound(message: string) {
    return new CustomError(message, 404);
  }

  public static serviceUnavailable(message: string) {
    return new CustomError(message, 503);
  }

  public static internalServerError(message: string) {
    return new CustomError(message, 500);
  }
}
