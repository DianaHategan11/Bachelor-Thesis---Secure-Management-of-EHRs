import React, { useState } from "react";
import axiosInstance from "../api";
import "../styling/Dashboard.css";
import { formatDate } from "../utils/date-formatter";

export default function ManagePermissions() {
  const [doctorAddr, setDoctorAddr] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [fieldLevelError, setFieldLevelError] = useState("");
  const [serverError, setServerError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!doctorAddr) {
      setFieldLevelError("Doctor Address required");
      return;
    }
    setFieldLevelError("");
    setLoading(true);
    setServerError("");
    setSuccessInfo(null);
    try {
      let response;
      if (action === "grant") {
        response = await axiosInstance.post("/records/access/grant", {
          doctorAddress: doctorAddr,
        });
      } else {
        response = await axiosInstance.delete("/records/access/revoke", {
          params: { doctorAddress: doctorAddr },
        });
      }
      setSuccessInfo({ ...response.data, action });
      setDoctorAddr("");
    } catch (err) {
      setServerError(
        err.response?.data?.error || "Managing Permissions failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className={`form-group ${fieldLevelError ? "error" : ""}`}>
        <label htmlFor="doctorAddress">Doctor's Blockchain Address</label>
        <input
          id="doctorAddress"
          type="text"
          value={doctorAddr}
          onChange={(e) => {
            setDoctorAddr(e.target.value);
          }}
        />
        {fieldLevelError && (
          <span className="text-danger">{fieldLevelError}</span>
        )}
      </div>
      <div className="form-group-select">
        <label htmlFor="actionSelect">Select Action</label>
        <div className="action-cell">
          <select
            className="action-select"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">-- Select --</option>
            <option value="grant">Grant Access</option>
            <option value="revoke">Revoke Access</option>
          </select>
          {action && (
            <button className="button" type="submit" disabled={loading}>
              {action === "grant" ? "Grant Access" : "Revoke Access"}
            </button>
          )}
        </div>
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
      {successInfo && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <p>
              {successInfo.action === "grant"
                ? `Access granted to doctor: `
                : `Access revoked from doctor: `}
            </p>
            <code className="mono">{successInfo.doctorName}</code>
            <p>Transaction: </p>
            <code className="mono">{successInfo.txHash}</code>
            <p>Mined in block number:</p>
            <code className="mono">{successInfo.blockNumber}</code>
            <p>Mined at:</p>
            <code className="mono">{formatDate(successInfo.timestamp)}</code>
            <button
              className="close-button"
              onClick={() => setSuccessInfo(null)}
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
            <p>Wait for the transaction to complete…</p>
          </div>
        </div>
      )}
    </form>
  );
}
