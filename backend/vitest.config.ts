import { defineConfig } from "vitest/config";

// Los tests nunca mandan mails: sin SMTP_HOST el back usa el notificador simulado (aunque el .env lo tenga)
export default defineConfig({
  test: { env: { SMTP_HOST: "" } },
});
