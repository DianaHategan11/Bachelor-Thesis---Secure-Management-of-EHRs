import React, { useState } from "react";
import useAuth from "../hooks/useAuth";
import "../styling/Dashboard.css";
import logo from "../images/logo.png";
import ViewDoctorAddresses from "../components/ViewDoctorAddresses";
import ManagePermissions from "../components/ManagePermissions";
import ViewPersonalMedicalRecords from "../components/ViewPersonalMedicalRecords";

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState("view-addr");

  const menuItems = [
    { key: "view-addr", label: "View Doctors" },
    { key: "view", label: "View Personal Records" },
    { key: "permissions", label: "Manage Permissions" },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <img src={logo} alt="HealthChain logo" className="dashboard-logo" />
        <p className="dashboard-message">
          <strong>Your Blockchain Addres:</strong>{" "}
          <code className="mono">{user?.address || "N/A"}</code>
          This is your unique public ID on our blockchain.
          <br />
          Share it with doctors so they can upload new records and you can
          visualize your health data.
        </p>

        <nav className="dashboard-menu">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`dashboard-menu-item ${
                selected === item.key ? "active" : ""
              }`}
              onClick={() => setSelected(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dashboard-content">
          {selected === "view-addr" && <ViewDoctorAddresses />}
          {selected === "view" && <ViewPersonalMedicalRecords />}
          {selected === "permissions" && <ManagePermissions />}
        </div>

        <button className="logout-button" onClick={logout}>
          Log Out
        </button>
      </div>
    </div>
  );
}
