import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Physics from "./pages/Physics";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard view="acceleration" />} />
        <Route path="/acceleration" element={<Dashboard view="acceleration" />} />
        <Route path="/rotation" element={<Dashboard view="rotation" />} />
        <Route path="/velocity" element={<Dashboard view="velocity" />} />
        <Route path="/impact" element={<Dashboard view="impact" />} />
        <Route path="/orientation" element={<Dashboard view="orientation" />} />
        <Route path="/physics" element={<Physics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
