import React, { useState } from "react";
import useAuth from "../hooks/useAuth";
import "../styling/Dashboard.css";
import logo from "../images/logo.png";
import AddMedicalRecordForm from "../components/AddMedicalRecord";
import ViewPatientAddresses from "../components/ViewPatientAddresses";
import ViewMedicalRecords from "../components/ViewMedicalRecords";
import ClusterStatistics from "../components/ClusterStatistics";

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState("view-addr");

  const menuItems = [
    { key: "view-addr", label: "View Patients" },
    { key: "add", label: "Add Medical Record" },
    { key: "view", label: "View Medical Records" },
    { key: "statistics", label: "Cluster Analysis" },
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
          Share it with patients so they can grant you permission to upload,
          view, or modify their records.
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
          {selected === "view-addr" && <ViewPatientAddresses />}
          {selected === "add" && <AddMedicalRecordForm />}
          {selected === "view" && <ViewMedicalRecords />}
          {selected === "statistics" && <ClusterStatistics />}
        </div>

        <button className="logout-button" onClick={logout}>
          Log Out
        </button>
      </div>
    </div>
  );
}
