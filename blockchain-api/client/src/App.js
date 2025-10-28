import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import PatientRegistration from "./pages/PatientRegistrationPage";
import DoctorRegistration from "./pages/DoctorRegistrationPage";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/patient" element={<PatientRegistration />} />
          <Route path="/register/doctor" element={<DoctorRegistration />} />

          <Route
            path="/patient/dashboard"
            element={
              <ProtectedRoute roles={["PATIENT"]}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute roles={["DOCTOR"]}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
