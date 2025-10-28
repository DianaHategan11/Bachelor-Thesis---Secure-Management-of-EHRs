import React, { useEffect, useState } from "react";
import axiosInstance from "../api";
import "../styling/Dashboard.css";
import "tippy.js/dist/tippy.css";

export default function ViewDoctorAddresses() {
  const [doctors, setDoctors] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [searchSpec, setSearchSpec] = useState("All");
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);

  const specs = Array.from(
    new Set(doctors.map((d) => d.specialization))
  ).sort();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data } = await axiosInstance.get("/doctors");
        setDoctors(data);
      } catch (err) {
        setServerError(
          err.response?.data?.error || err.message || "Failed to load doctors"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = doctors
    .filter((d) => {
      const fullName = `${d.firstName} ${d.lastName}`.toLowerCase();
      return fullName.includes(searchName.toLowerCase());
    })
    .filter((d) => {
      return searchSpec === "All" || d.specialization === searchSpec;
    });

  return (
    <>
      <div className="filters">
        <input
          className="search-input"
          type="text"
          placeholder="Search doctor by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />

        <div className="filter-row">
          <label htmlFor="searchSpec" className="filter-label">
            Search by Specialization :
          </label>
          <select
            id="searchSpec"
            className="search-input"
            value={searchSpec}
            onChange={(e) => setSearchSpec(e.target.value)}
          >
            <option value="All">All Specializations</option>
            {specs.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Specialization</th>
              <th>Blockchain&nbsp;Address</th>
            </tr>
          </thead>
          <tbody>
            {doctors.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={3}>
                  There are no doctors registered at the moment.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={4}>There are no doctors matching the filters.</td>
              </tr>
            ) : (
              filtered.map((d, i) => (
                <tr key={d.address}>
                  <td>{i + 1}</td>
                  <td>{`${d.firstName} ${d.lastName}`}</td>
                  <td>{d.specialization}</td>
                  <td>
                    <code className="addr">{d.address}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
      </div>
    </>
  );
}
