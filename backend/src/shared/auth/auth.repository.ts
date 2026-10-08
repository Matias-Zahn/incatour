import { db } from "../../config/postgresDatabase";

export class AuthRepository {
  async buscarPorEmail(email: string) {
    return db.usuario.findUnique({
      where: { email }
    });
  }
}
