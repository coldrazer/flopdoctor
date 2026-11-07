import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider } from "./lib/store.tsx";
import Diagnosis from "./screens/Diagnosis.tsx";
import Prescription from "./screens/Prescription.tsx";
import ShareCard from "./screens/ShareCard.tsx";
import WheelIntake from "./screens/WheelIntake.tsx";

// HashRouter so the build works on any static host (Lovable, GMI Cloud, a plain bucket).
export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<WheelIntake />} />
          <Route path="/d/:platform/:handle" element={<Diagnosis />} />
          <Route path="/rx/:platform/:handle" element={<Prescription />} />
          <Route path="/share/:platform/:handle" element={<ShareCard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}
