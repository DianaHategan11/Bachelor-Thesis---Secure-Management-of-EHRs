import React, { useEffect, useState } from "react";
import axiosInstance from "../api";
import "../styling/Dashboard.css";
import { formatDate, formatShortDate } from "../utils/date-formatter";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

export default function ViewPersonalMedicalRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);
  const [selected, setSelected] = useState(null);

  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const shorten = (addr) => addr.slice(0, 6) + "…" + addr.slice(-4);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data } = await axiosInstance.get("/records/patient");
        setRecords(data);
      } catch (err) {
        setServerError(
          err.response?.data?.error || err.message || "Failed to load records"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredRecords = records
    .filter((r) => {
      const full = (r.doctorName || "").toLowerCase();
      return full.includes(filterDoctor.toLowerCase());
    })
    .filter((r) => {
      if (!filterDate) return true;
      return formatShortDate(r.modifiedAt) === filterDate;
    });

  const onView = async (id, seq) => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/records/signer/${id}`);
      const {
        patient,
        doctor,
        encounter,
        condition,
        medicationRequest,
        observations,
        carePlan,
        procedure,
        timestamp,
      } = data;
      const selectedRecord = {
        seq,
        recordId: id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        gender: `${patient.gender}`,
        birthDate: `${patient.birthDate}`,
        doctorName: `${doctor.firstName} ${doctor.lastName}`,
        encounterDate: encounter?.start,
        conditions: condition?.display ? [condition.display] : [],
        conditionsDate: condition?.onsetDateTime,
        medications: medicationRequest
          ? [
              {
                name: medicationRequest.display,
                dose: medicationRequest.dosage,
              },
            ].filter((p) => p.name && p.name.length > 0)
          : [],
        observations:
          observations?.components.map((c) => ({
            code: c.display,
            value: c.value,
            unit: c.unit,
            effectiveDate: observations.effectiveDateTime,
          })) ?? [],
        carePlan: carePlan
          ? [
              {
                display: carePlan.display,
                from: carePlan.periodStart,
                to: carePlan.periodEnd,
              },
            ].filter((p) => p.display && p.display.length > 0)
          : [],
        procedures: procedure
          ? [
              {
                name: procedure.display,
                date: procedure.performedDateTime,
              },
            ].filter((p) => p.name && p.name.length > 0)
          : [],
        timestamp,
      };
      setSelected(selectedRecord);
    } catch (err) {
      setServerError(
        err.response?.data?.error || err.message || "Failed to load record"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!selected && (
        <>
          <div className="filters">
            <div className="filter-row">
              <input
                type="text"
                className="search-input"
                placeholder="Search by doctor…"
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
              />
            </div>
            <div className="filter-row">
              <label className="filter-label">Search by Date:</label>
              <input
                type="date"
                className="search-input"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Record&nbsp;Id</th>
                  <th>Date&nbsp;Recorded</th>
                  <th>Doctor</th>
                  <th>Doctor&nbsp;Address</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={4}>
                      There are no records to display at the moment.
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={4}>
                      There are no records matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, i) => (
                    <tr key={r.recordId}>
                      <td>{i + 1}</td>
                      <td>{formatDate(r.timestamp)}</td>
                      <td>{r.doctorName}</td>
                      <td>
                        <Tippy
                          content={
                            <div
                              style={{
                                whiteSpace: "nowrap",
                                userSelect: "text",
                              }}
                            >
                              {r.doctor}
                            </div>
                          }
                          interactive={true}
                          trigger="mouseenter focus"
                          maxWidth="none"
                        >
                          <code className="addr">{shorten(r.doctor)}</code>
                        </Tippy>
                      </td>
                      <td className="action-cell">
                        <button
                          className="btn-view"
                          aria-label={`View record ${r.recordId}`}
                          onClick={() => onView(r.recordId, i + 1)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <div className="record-detail">
          <button
            className="btn-close-detail"
            onClick={() => setSelected(null)}
          >
            Close
          </button>

          <h2>Record No. {selected.seq}</h2>

          <p>
            <strong>Patient:</strong> {selected.patientName}
          </p>
          <p>
            <strong>Gender:</strong> {selected.gender}
          </p>
          <p>
            <strong>Birth date:</strong>
            {formatShortDate(selected.birthDate)}
          </p>
          <p>
            <strong>Doctor:</strong> {selected.doctorName}
          </p>
          <p>
            <strong>Date:</strong> {formatDate(selected.encounterDate)}
          </p>

          {selected.conditions.length > 0 && (
            <section>
              <h3>Diagnosis</h3>
              <p>
                {selected.conditions}
                {selected.conditionsDate &&
                  ` — on ${formatShortDate(selected.conditionsDate)}`}
              </p>
            </section>
          )}

          {selected.medications?.length > 0 && (
            <section>
              <h3>Prescription Details</h3>
              <ul>
                {selected.medications.map((m, idx) => (
                  <li key={idx}>
                    {m.name} : {m.dose}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {selected.observations?.length > 0 && (
            <section>
              <h3>Observations</h3>
              <ul>
                {selected.observations.map((obs, idx) => (
                  <li key={idx}>
                    {obs.code}: {obs.value} {obs.unit} — on{" "}
                    {formatDate(obs.effectiveDate)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {selected.carePlan?.length > 0 && (
            <section>
              <h3>Care Plan</h3>
              {Array.isArray(selected.carePlan) ? (
                <ul>
                  {selected.carePlan.map((cp, idx) => (
                    <li key={idx}>
                      {cp.display}{" "}
                      {cp.from && ` — from ${formatShortDate(cp.from)}`}{" "}
                      {cp.to && ` to ${formatShortDate(cp.to)}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <pre>{JSON.stringify(selected.carePlan, null, 2)}</pre>
              )}
            </section>
          )}

          {selected.procedures?.length > 0 && (
            <section>
              <h3>Procedures</h3>
              <ul>
                {selected.procedures.map((proc, idx) => (
                  <li key={idx}>
                    {proc.name || proc.code || JSON.stringify(proc)}{" "}
                    {proc.date && `— on ${formatShortDate(proc.date)}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {serverError && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="text-danger">Server Error:</h2>
            <p>{serverError}</p>
            <button
              className="close-button"
              onClick={() => setServerError(null)}
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
            <p>Fetching results…</p>
          </div>
        </div>
      )}
    </>
  );
}
