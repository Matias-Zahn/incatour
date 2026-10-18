import LayoutGestion from "./components/LayoutGestion";
import CuentasGuiaPage from "./pages/gestion/CuentasGuiaPage";
import InicioGestionPage from "./pages/gestion/InicioGestionPage";
import PersonalPage from "./pages/gestion/PersonalPage";
import ProveedoresPage from "./pages/gestion/ProveedoresPage";
import ServiciosPage from "./pages/gestion/ServiciosPage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <LayoutGestion seccion="Inicio">
              <InicioGestionPage />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
