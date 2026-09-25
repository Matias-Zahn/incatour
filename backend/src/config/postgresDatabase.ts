import { PrismaClient } from "@prisma/client";

export class PostgresDatabase {
  private static instance: PostgresDatabase;
  public prisma: PrismaClient;

  private constructor() {
    // Prisma gestiona automáticamente la URL desde el .env y el pool de conexiones
    this.prisma = new PrismaClient();
  }

  // Punto de acceso global a la instancia única
  public static getInstance(): PostgresDatabase {
    if (!PostgresDatabase.instance) {
      PostgresDatabase.instance = new PostgresDatabase();
    }
    return PostgresDatabase.instance;
  }

  // Método para verificar la conexión inicial al levantar el backend
  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      console.log("✅ Conectado a PostgreSQL con Prisma exitosamente");
    } catch (error) {
      console.error("❌ Error al conectar con PostgreSQL vía Prisma:", error);
      throw error;
    }
  }
}

// Exportamos directamente la instancia de Prisma para usarla más fácil en los repositorios
export const db = PostgresDatabase.getInstance().prisma;
