import "dotenv/config";
import { get } from "env-var";

export const envs = {
  PORT: get("PORT").required().asPortNumber(),
  DB_HOST: get("DB_HOST").required().asString(),
  DB_USER: get("DB_USER").required().asString(),
  DB_PASSWORD: get("DB_PASSWORD").asString(),
  DB_NAME: get("DB_NAME").required().asString(),
  DB_PORT: get("DB_PORT").required().asPortNumber(),
  JWT_SEED: get("JWT_SEED").required().asString(),
  // Mails: sin SMTP_HOST se escriben en la consola. En desarrollo, Mailpit (docker compose) en localhost:1025
  SMTP_HOST: get("SMTP_HOST").asString(),
  SMTP_PORT: get("SMTP_PORT").default("1025").asPortNumber(),
  SMTP_USER: get("SMTP_USER").asString(),
  SMTP_PASSWORD: get("SMTP_PASSWORD").asString(),
  SMTP_FROM: get("SMTP_FROM").default("IncaTour <no-responder@incatour.com>").asString(),
};
