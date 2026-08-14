import { Pool } from "pg";
import { envs } from "./envs";

export class PostgresDatabase {
  private static instance: PostgresDatabase;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      host: envs.DB_HOST,
      port: envs.DB_PORT,
      user: envs.DB_USER,
      password: envs.DB_PASSWORD,
      database: envs.DB_NAME,
      max: 20, // Cantidad máxima de clientes en el pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      console.error("❌ Error inesperado en el pool de PostgreSQL:", err);
    });
  }

  // Punto de acceso global a la instancia única
  public static getInstance(): PostgresDatabase {
    if (!PostgresDatabase.instance) {
      PostgresDatabase.instance = new PostgresDatabase();
    }
    return PostgresDatabase.instance;
  }

  // Método para verificar la conexión inicial
  public async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      console.log("✅ Conectado a PostgreSQL exitosamente");
      client.release();
    } catch (error) {
      console.error("❌ Error al conectar con PostgreSQL:", error);
      throw error;
    }
  }
}
