import LayoutGestion from "./components/LayoutGestion";
import InicioGestionPage from "./pages/gestion/InicioGestionPage";

function App() {
  return (
    <LayoutGestion seccion="Inicio">
      <InicioGestionPage />
    </LayoutGestion>
  );
}

export default App;
