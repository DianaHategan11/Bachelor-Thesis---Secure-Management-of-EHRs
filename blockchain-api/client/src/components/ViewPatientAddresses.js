import React, { useEffect, useState } from "react";
import axiosInstance from "../api";
import "../styling/Dashboard.css";

export default function ViewPatientAddresses() {
  const [patients, setPatients] = useState([]);
  const [searchItem, setSearchItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data } = await axiosInstance.get("/patients");
        setPatients(data);
      } catch (err) {
        setServerError(
          err.response?.data?.error || err.message || "Failed to load patients"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = patients.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(searchItem.toLowerCase());
  });

  return (
    <>
      <div className="table-wrapper">
        <input
          className="search-input"
          id="searchItem"
          type="text"
          placeholder="Search patient by name..."
          value={searchItem}
          onChange={(e) => setSearchItem(e.target.value)}
          style={{ marginBottom: 12, padding: 8, width: "100%" }}
        />

        <table className="table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Blockchain&nbsp;Address</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={3}>
                  There are no patients registered at the moment.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={3}>There are no patients matching the filters.</td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.address}>
                  <td>{i + 1}</td>
                  <td>{`${p.firstName} ${p.lastName}`}</td>
                  <td>
                    <code className="addr">{p.address}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {serverError && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="text-danger">Server Error:</h2>
            <p>{serverError}</p>
            <button
              className="close-button"
              onClick={() => setServerError("")}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
      )}
      {loading && (
        <div className="dialog-overlay">
          <div className="dialog-box flex-center">
            <div className="spinner" aria-label="Loading" />
            <p>Wait for fetching the results…</p>
          </div>
        </div>
      )}
    </>
  );
}
