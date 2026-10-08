import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IncaTour API",
      version: "1.0.0",
      description: "API de IncaTour para la gestión de paquetes, reservas y solicitudes de alojamiento.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Servidor de Desarrollo Local",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Ingresá el token JWT obtenido del endpoint POST /api/auth/login"
        }
      }
    }
  },
  // Documentaremos los endpoints a través de comentarios JSDoc en los controladores
  apis: ["./src/modulos/**/*.ts", "./src/shared/**/*.ts"],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "IncaTour API Docs",
  }));
};
