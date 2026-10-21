import LayoutCliente from "./components/LayoutCliente";
import LayoutGestion from "./components/LayoutGestion";
import CatalogoCompraPage from "./pages/cliente/CatalogoCompraPage";
import MisReseniasPage from "./pages/cliente/MisReseniasPage";
import MisReservasPage from "./pages/cliente/MisReservasPage";
import RegistroClientePage from "./pages/cliente/RegistroClientePage";
import CircuitosPage from "./pages/gestion/CircuitosPage";
import CuentasGuiaPage from "./pages/gestion/CuentasGuiaPage";
import EtapasPage from "./pages/gestion/EtapasPage";
import EvaluacionesPage from "./pages/gestion/EvaluacionesPage";
import InicioGestionPage from "./pages/gestion/InicioGestionPage";
import PaquetesPage from "./pages/gestion/PaquetesPage";
import PersonalPage from "./pages/gestion/PersonalPage";
import ProveedoresPage from "./pages/gestion/ProveedoresPage";
import ServiciosPage from "./pages/gestion/ServiciosPage";
import SolicitudesPage from "./pages/gestion/SolicitudesPage";
import TemporadasPage from "./pages/gestion/TemporadasPage";
import PortalGuiaPage from "./pages/guia/PortalGuiaPage";
import Login from "./pages/Login";
import RutaProtegida from "./components/RutaProtegida";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/registro"
          element={
            <LayoutCliente>
              <RegistroClientePage />
            </LayoutCliente>
          }
        />
        <Route
          path="/cliente/registro"
          element={
            <LayoutCliente>
              <RegistroClientePage />
            </LayoutCliente>
          }
        />
        <Route
          path="/catalogo"
          element={
            <LayoutCliente>
              <CatalogoCompraPage />
            </LayoutCliente>
          }
        />

        {/* Rutas exclusivas del perfil CLIENTE (CU-31, CU-32, CU-47) */}
        <Route element={<RutaProtegida roles={["CLIENTE"]} />}>
          <Route
            path="/mis-reservas"
            element={
              <LayoutCliente>
                <MisReservasPage />
              </LayoutCliente>
            }
          />
          <Route
            path="/cliente/reservas"
            element={
              <LayoutCliente>
                <MisReservasPage />
              </LayoutCliente>
            }
          />
          <Route
            path="/mis-resenias"
            element={
              <LayoutCliente>
                <MisReseniasPage />
              </LayoutCliente>
            }
          />
          <Route
            path="/cliente/resenias"
            element={
              <LayoutCliente>
                <MisReseniasPage />
              </LayoutCliente>
            }
          />
        </Route>

        {/* Rutas exclusivas del perfil GUÍA (CU-48, CU-49, CU-50) */}
        <Route element={<RutaProtegida roles={["GUIA"]} />}>
          <Route path="/guia" element={<PortalGuiaPage />} />
          <Route path="/guia/:seccion" element={<PortalGuiaPage />} />
        </Route>

        {/* Rutas exclusivas del perfil ADMIN */}
        <Route element={<RutaProtegida roles={["ADMIN"]} />}>
          <Route
            path="/"
            element={
              <LayoutGestion seccion="Inicio">
                <InicioGestionPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/circuitos"
            element={
              <LayoutGestion seccion="Circuitos">
                <CircuitosPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/circuitos/:idCircuito/etapas"
            element={
              <LayoutGestion seccion="Circuitos">
                <EtapasPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/temporadas"
            element={
              <LayoutGestion seccion="Circuitos">
                <TemporadasPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/paquetes"
            element={
              <LayoutGestion seccion="Paquetes turísticos">
                <PaquetesPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/proveedores"
            element={
              <LayoutGestion seccion="Proveedores">
                <ProveedoresPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/proveedores/:idProveedor/servicios"
            element={
              <LayoutGestion seccion="Proveedores">
                <ServiciosPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/solicitudes"
            element={
              <LayoutGestion seccion="Reservas y pagos">
                <SolicitudesPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/personal"
            element={
              <LayoutGestion seccion="Personal">
                <PersonalPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/cuentas-guia"
            element={
              <LayoutGestion seccion="Personal">
                <CuentasGuiaPage />
              </LayoutGestion>
            }
          />
          <Route
            path="/gestion/evaluaciones"
            element={
              <LayoutGestion seccion="Reseñas y evaluaciones">
                <EvaluacionesPage />
              </LayoutGestion>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
