import express from "express";
import cors from "cors";
import { envs } from "./config/envs";
import { ClienteRoutes } from "./routes/cliente.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/", (req, res) => {
  res.json({ message: "HOLA" });
});

//RUTAS
// Para clientes - Registro - Reservas - ETC
app.use("/api/clientes", ClienteRoutes.getRoutes);

//ACA IRIAN las demas

app.listen(envs.PORT, () => {
  console.log(`SERVIDOR corriendo en el puerto ${envs.PORT}`);
});
