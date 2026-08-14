export class CustomError extends Error {
  private constructor(
    public message: string,
    public statusCode: number,
  ) {
    super(message);
  }

  public static badRequest(message: string) {
    return new CustomError(message, 400);
  }

  public static unauthorized(message: string) {
    return new CustomError(message, 401);
  }
  public static forbidden(message: string) {
    return new CustomError(message, 403);
  }

  public static notFound(message: string) {
    return new CustomError(message, 404);
  }

  public static internalServerError(message: string) {
    return new CustomError(message, 500);
  }
}
