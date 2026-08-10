import { BrowserRouter, Route, Routes } from "react-router-dom";
import DataDemo from "./pages/data-demo";
import Daymark from "./pages/daymark";
import DesignKitDemo from "./pages/_design";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/_design" element={<DesignKitDemo />} />
          <Route path="/data-demo" element={<DataDemo />} />
          <Route path="/" element={<Daymark />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
