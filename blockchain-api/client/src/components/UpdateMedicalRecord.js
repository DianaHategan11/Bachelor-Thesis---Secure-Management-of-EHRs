import React, { useState, useEffect } from "react";
import axiosInstance from "../api";
import useAuth from "../hooks/useAuth";
import "../styling/Dashboard.css";
import {
  joiSchemasToFieldErrors,
  validateRecord,
} from "../utils/validate-record";
import { formatDate } from "../utils/date-formatter";

export const ENCOUNTER_CLASS = [
  { code: "AMB", label: "Ambulatory / Out-patient" },
  { code: "EMER", label: "Emergency department" },
  { code: "IMP", label: "In-patient" },
];

export const OBSERVATIONS = [
  { key: "weight", display: "Body weight", numeric: true, unit: "kg" },
  { key: "height", display: "Body height", numeric: true, unit: "cm" },
  {
    key: "hRate",
    display: "Heart Rate",
    numeric: true,
    unit: "/min",
  },
  {
    key: "respRate",
    display: "Respiratory Rate",
    numeric: true,
    unit: "/min",
  },
  { key: "temp", display: "Body temperature", numeric: true, unit: "Cel" },
  {
    key: "sbp",
    display: "Systolic blood pressure",
    numeric: true,
    unit: "mmHg",
  },
  {
    key: "dbp",
    display: "Diastolic blood pressure",
    numeric: true,
    unit: "mmHg",
  },
  {
    key: "cholesterol",
    display: "Cholesterol",
    numeric: true,
    unit: "mg/dL",
  },
  {
    key: "glucose",
    display: "Glucose",
    numeric: true,
    unit: "mg/dL",
  },
  {
    key: "creatinine",
    display: "Creatinine",
    numeric: true,
    unit: "mg/dL",
  },
  {
    key: "hemoglobin",
    display: "Hemoglobin",
    numeric: true,
    unit: "g/dL",
  },
];

export const OBS_FAMILY_PRACTICE = [
  OBSERVATIONS.find((o) => o.key === "weight"),
  OBSERVATIONS.find((o) => o.key === "height"),
  OBSERVATIONS.find((o) => o.key === "temp"),
];

export const OBS_CARDIOLOGY = [
  OBSERVATIONS.find((o) => o.key === "hRate"),
  OBSERVATIONS.find((o) => o.key === "sbp"),
  OBSERVATIONS.find((o) => o.key === "dbp"),
  OBSERVATIONS.find((o) => o.key === "cholesterol"),
];

export const OBS_INTERNAL = [
  OBSERVATIONS.find((o) => o.key === "sbp"),
  OBSERVATIONS.find((o) => o.key === "dbp"),
  OBSERVATIONS.find((o) => o.key === "cholesterol"),
  OBSERVATIONS.find((o) => o.key === "glucose"),
  OBSERVATIONS.find((o) => o.key === "creatinine"),
  OBSERVATIONS.find((o) => o.key === "hemoglobin"),
];

export default function UpdateMedicalRecordForm({ recordId, onDone, onError }) {
  const [patientAddress, setPatientAddress] = useState("");
  const { user } = useAuth();

  const [encounter, setEncounter] = useState({
    start: "",
    end: "",
    class: "AMB",
  });
  const [condition, setCondition] = useState({
    display: "",
    onsetDateTime: "",
  });
  const [medicationRequest, setMedicationRequest] = useState({
    display: "",
    dosage: "",
  });
  const [observations, setObservations] = useState({
    effectiveDateTime: "",
    components: [],
  });
  const [specObs, setSpecObs] = useState(OBSERVATIONS);
  const [carePlan, setCarePlan] = useState({
    display: "",
    periodStart: "",
    periodEnd: "",
  });
  const [procedure, setProcedure] = useState({
    display: "",
    performedDateTime: "",
  });

  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [serverError, setServerError] = useState("");
  const [fieldLevelError, setFieldLevelError] = useState("");
  const [errors, setErrors] = useState({ patientAddress: "" });

  const isConditionPartial =
    (condition.display && !condition.onsetDateTime) ||
    (!condition.display && condition.onsetDateTime);
  const isPrescriptionPartial =
    (medicationRequest.display && !medicationRequest.dosage) ||
    (!medicationRequest.display && medicationRequest.dosage);
  const isObservationsPartial =
    (observations.effectiveDateTime && observations.components.length === 0) ||
    (!observations.effectiveDateTime && observations.components.length > 0);
  const isCarePlanPartial =
    (carePlan.display || carePlan.periodStart || carePlan.periodEnd) &&
    (!carePlan.display || !carePlan.periodStart || !carePlan.periodEnd);
  const isProcedurePartial =
    (procedure.display && !procedure.performedDateTime) ||
    (!procedure.display && procedure.performedDateTime);

  function toDateTimeLocal(isoString) {
    if (!isoString) return "";
    const dt = new Date(isoString);
    const off = dt.getTimezoneOffset();
    const local = new Date(dt.getTime() - off * 60_000);
    return local.toISOString().slice(0, 16);
  }

  function toDateLocal(isoString) {
    if (!isoString) return "";
    const dt = new Date(isoString);
    return dt.toISOString().slice(0, 10);
  }

  useEffect(() => {
    axiosInstance
      .get(`/records/signer/${recordId}`)
      .then(({ data }) => {
        console.log(data);
        setPatientAddress(data.patient.address);
        setEncounter({
          start: toDateTimeLocal(data.encounter.start),
          end: toDateTimeLocal(data.encounter.end),
          class: data.encounter?.class || "AMB",
        });
        setCondition({
          display: data.condition?.display || "",
          onsetDateTime: toDateLocal(data.condition?.onsetDateTime) || "",
        });
        setMedicationRequest({
          display: data.medicationRequest?.display || "",
          dosage: data.medicationRequest?.dosage || "",
        });
        setObservations({
          effectiveDateTime:
            toDateTimeLocal(data.observations?.effectiveDateTime) || "",
          components: (data.observations?.components || []).map((comp) => {
            const cat =
              OBSERVATIONS.find((o) => o.display === comp.display) || {};
            return {
              key: cat.key,
              display: cat.display,
              value: comp.value ?? "",
              unit: cat.unit || "",
            };
          }),
        });
        setCarePlan({
          display: data.carePlan?.display || "",
          periodStart: toDateLocal(data.carePlan?.periodStart) || "",
          periodEnd: toDateLocal(data.carePlan?.periodEnd) || "",
        });
        setProcedure({
          display: data.procedure?.display || "",
          performedDateTime:
            toDateTimeLocal(data.procedure?.performedDateTime) || "",
        });
      })
      .catch((err) => {
        setServerError(err.response?.data?.error || "Failed to load record");
      });
  }, [recordId]);

  useEffect(() => {
    if (!user?.address) return;
    async function loadSpecs() {
      const { data } = await axiosInstance.get("/doctor/specialization", {
        params: { doctorAddress: user.address },
      });
      const spec = data.specialization;
      if (spec === "Family Practice") {
        setSpecObs(OBS_FAMILY_PRACTICE);
      } else if (spec === "General Practice") {
        setSpecObs(OBS_FAMILY_PRACTICE);
      } else if (spec === "Cardiology") {
        setSpecObs(OBS_CARDIOLOGY);
      } else if (spec === "Internal Medicine") {
        setSpecObs(OBS_INTERNAL);
      }
    }
    loadSpecs();
  }, [user.address]);

  const addComponent = () => {
    const obs = OBSERVATIONS[0];
    setObservations((o) => ({
      ...o,
      components: [
        ...o.components,
        { key: obs.key, display: obs.display, value: "", unit: obs.unit ?? "" },
      ],
    }));
  };

  const changeComponent = (id, field, val) => {
    setObservations((o) => {
      const next = [...o.components];
      let row = { ...next[id], [field]: val };

      if (field === "key") {
        const cat = OBSERVATIONS.find((c) => c.key === val) || {};
        row = {
          key: cat.key || val,
          display: cat.display || val,
          value: "",
          unit: cat.numeric ? cat.unit : "",
        };
      }
      next[id] = row;
      return { ...o, components: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setServerError("");
    setSuccessInfo(null);
    setFieldLevelError(null);
    if (!patientAddress) {
      setFieldLevelError("Please fill in the patient's address.");
      setLoading(false);
      return;
    }
    if (!encounter.start || !encounter.end) {
      setFieldLevelError("Please fill in the the encounter dates.");
      setLoading(false);
      return;
    }
    const payload = {
      patientAddress,
      encounter,
      condition,
      medicationRequest,
      observations,
      carePlan,
      procedure,
    };
    const res = validateRecord(payload);
    if (!res.ok) {
      setErrors(joiSchemasToFieldErrors(res.details));
      setFieldLevelError(
        "Please fill in all the required fields before submitting."
      );
      setServerError("");
      setLoading(false);
      return;
    }
    setErrors({});
    const validatedPayload = res.value;
    try {
      const { data } = await axiosInstance.put(
        `/records/${recordId}`,
        validatedPayload
      );
      setSuccessInfo(data);
      onDone();
    } catch (err) {
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <h1>Update Form</h1>
      <div className={`form-group ${errors.patientAddress ? "error" : ""}`}>
        <label htmlFor="patientAddress">Patient's Blockchain Address</label>
        <input
          id="patientAddress"
          type="text"
          value={patientAddress}
          onChange={(e) => {
            setPatientAddress(e.target.value);
            setErrors((p) => ({ ...p, patientAddress: "" }));
          }}
        />
        {errors.patientAddress && (
          <span className="text-danger">{errors.patientAddress}</span>
        )}
      </div>
      <h4>Encounter</h4>
      <div className="section-group">
        <div
          className={`form-group ${errors["encounter.start"] ? "error" : ""}`}
        >
          <label>Encounter Start</label>
          <input
            type="datetime-local"
            value={encounter.start}
            onChange={(e) => {
              setEncounter((enc) => ({ ...enc, start: e.target.value }));
              setErrors((enc) => ({ ...enc, "encounter.start": "" }));
            }}
          />
          {errors["encounter.start"] && (
            <span className="text-danger">{errors["encounter.start"]}</span>
          )}
        </div>
        <div className={`form-group ${errors["encounter.end"] ? "error" : ""}`}>
          <label>Encounter End</label>
          <input
            type="datetime-local"
            value={encounter.end}
            onChange={(e) => {
              setEncounter((enc) => ({ ...enc, end: e.target.value }));
              setErrors((enc) => ({ ...enc, "encounter.end": "" }));
            }}
          />
          {errors["encounter.end"] && (
            <span className="text-danger">{errors["encounter.end"]}</span>
          )}
        </div>
        <div
          className={`form-group ${errors["encounter.class"] ? "error" : ""}`}
        >
          <label>Encounter Type</label>
          <select
            value={encounter.class}
            onChange={(e) => {
              setEncounter((enc) => ({ ...enc, class: e.target.value }));
              setErrors((enc) => ({ ...enc, "encounter.class": "" }));
            }}
          >
            {ENCOUNTER_CLASS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors["encounter.class"] && (
            <span className="text-danger">{errors["encounter.class"]}</span>
          )}
        </div>
      </div>
      <h4>Diagnosis</h4>
      <div className="section-group">
        <div
          className={`form-group ${errors["condition.display"] ? "error" : ""}`}
        >
          <label>Condition</label>
          <textarea
            value={condition.display}
            onChange={(e) => {
              setCondition((c) => ({ ...c, display: e.target.value }));
              setErrors((err) => ({ ...err, "condition.display": "" }));
            }}
          />
          {errors["condition.display"] && (
            <span className="text-danger">{errors["condition.display"]}</span>
          )}
        </div>
        <div
          className={`form-group ${
            errors["condition.onsetDateTime"] ? "error" : ""
          }`}
        >
          <label>Onset Date</label>
          <input
            type="date"
            value={condition.onsetDateTime}
            onChange={(e) => {
              setCondition((c) => ({ ...c, onsetDateTime: e.target.value }));
              setErrors((err) => ({ ...err, "condition.onsetDateTime": "" }));
            }}
          />
          {errors["condition.onsetDateTime"] && (
            <span className="text-danger">
              {errors["condition.onsetDateTime"]}
            </span>
          )}
        </div>
        {isConditionPartial && (
          <span className="text-danger">Please fill in this section.</span>
        )}
      </div>
      <h4>Prescription Details</h4>
      <div className="section-group">
        <div
          className={`form-group ${
            errors["medicationRequest.display"] ? "error" : ""
          }`}
        >
          <label>Medication Name</label>
          <textarea
            value={medicationRequest.display}
            onChange={(e) => {
              setMedicationRequest((m) => ({ ...m, display: e.target.value }));
              setErrors((err) => ({ ...err, "medicationRequest.display": "" }));
            }}
          />
          {errors["medicationRequest.display"] && (
            <span className="text-danger">
              {errors["medicationRequest.display"]}
            </span>
          )}
        </div>
        <div
          className={`form-group ${
            errors["medicationRequest.dosage"] ? "error" : ""
          }`}
        >
          <label>Dosage</label>
          <textarea
            value={medicationRequest.dosage}
            onChange={(e) => {
              setMedicationRequest((m) => ({ ...m, dosage: e.target.value }));
              setErrors((err) => ({ ...err, "medicationRequest.dosage": "" }));
            }}
          />
          {errors["medicationRequest.dosage"] && (
            <span className="text-danger">
              {errors["medicationRequest.dosage"]}
            </span>
          )}
        </div>
        {isPrescriptionPartial && (
          <span className="text-danger">Please fill in this section.</span>
        )}
      </div>
      <h4>Observations</h4>
      <div
        className={`form-group ${
          errors["observations.effectiveDateTime"] ? "error" : ""
        }`}
      >
        <label>Recorded At</label>
        <input
          type="datetime-local"
          value={observations.effectiveDateTime}
          onChange={(e) => {
            setObservations((o) => ({
              ...o,
              effectiveDateTime: e.target.value,
            }));
            setErrors((err) => ({
              ...err,
              "observations.effectiveDateTime": "",
            }));
          }}
        />
        {errors["observations.effectiveDateTime"] && (
          <span className="text-danger">
            {errors["observations.effectiveDateTime"]}
          </span>
        )}
      </div>

      {observations.components.map((c, i) => {
        const selectedKeys = observations.components.map((cmp) => cmp.key);
        const options = specObs.filter(
          (o) => o.key === c.key || !selectedKeys.includes(o.key)
        );
        const cat = OBSERVATIONS.find((x) => x.key === c.key) || {};
        return (
          <div key={i} className="section-group">
            <select
              value={c.key}
              onChange={(e) => changeComponent(i, "key", e.target.value)}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.display}
                </option>
              ))}
            </select>
            {cat.numeric ? (
              <>
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="any"
                    value={c.value}
                    onChange={(e) =>
                      changeComponent(i, "value", e.target.value)
                    }
                    required
                  />
                  <span className="unit-label">{cat.unit}</span>
                </div>
              </>
            ) : (
              <input
                type="text"
                value={c.value}
                onChange={(e) => changeComponent(i, "value", e.target.value)}
                required
              />
            )}
          </div>
        );
      })}
      {errors["observations.components"] && (
        <span className="text-danger">{errors["observations.components"]}</span>
      )}
      {isObservationsPartial && (
        <span className="text-danger">Please fill in this section.</span>
      )}
      <button type="button" className="button" onClick={addComponent}>
        Add measurement
      </button>
      <h4>Care Plan</h4>
      <div className="section-group">
        <div
          className={`form-group ${errors["carePlan.display"] ? "error" : ""}`}
        >
          <label>Description</label>
          <textarea
            value={carePlan.display}
            onChange={(e) => {
              setCarePlan((cp) => ({ ...cp, display: e.target.value }));
              setErrors((err) => ({ ...err, "carePlan.display": "" }));
            }}
          />
          {errors["carePlan.display"] && (
            <span className="text-danger">{errors["carePlan.display"]}</span>
          )}
        </div>
        <div
          className={`form-group ${
            errors["carePlan.periodStart"] ? "error" : ""
          }`}
        >
          <label>Start Date</label>
          <input
            type="date"
            value={carePlan.periodStart}
            onChange={(e) => {
              setCarePlan((cp) => ({ ...cp, periodStart: e.target.value }));
              setErrors((cp) => ({ ...cp, "carePlan.periodStart": "" }));
            }}
          />
          {errors["carePlan.periodStart"] && (
            <span className="text-danger">
              {errors["carePlan.periodStart"]}
            </span>
          )}
        </div>
        <div
          className={`form-group ${
            errors["carePlan.periodEnd"] ? "error" : ""
          }`}
        >
          <label>End Date</label>
          <input
            type="date"
            value={carePlan.periodEnd}
            onChange={(e) => {
              setCarePlan((cp) => ({ ...cp, periodEnd: e.target.value }));
              setErrors((cp) => ({ ...cp, "carePlan.periodEnd": "" }));
            }}
          />
          {errors["carePlan.periodEnd"] && (
            <span className="text-danger">{errors["carePlan.periodEnd"]}</span>
          )}
        </div>
        {isCarePlanPartial && (
          <span className="text-danger">Please fill in this section.</span>
        )}
      </div>
      <h4>Procedure</h4>
      <div className="section-group">
        <div
          className={`form-group ${errors["procedure.display"] ? "error" : ""}`}
        >
          <label>Procedure Name</label>
          <textarea
            value={procedure.display}
            onChange={(e) => {
              setProcedure((p) => ({ ...p, display: e.target.value }));
              setErrors((err) => ({ ...err, "procedure.display": "" }));
            }}
          />
          {errors["procedure.display"] && (
            <span className="text-danger">{errors["procedure.display"]}</span>
          )}
        </div>
        <div
          className={`form-group ${
            errors["procedure.performedDateTime"] ? "error" : ""
          }`}
        >
          <label>Procedure Date</label>
          <input
            type="date"
            value={procedure.performedDateTime}
            onChange={(e) => {
              setProcedure((p) => ({
                ...p,
                performedDateTime: e.target.value,
              }));
              setErrors((err) => ({
                ...err,
                "procedure.performedDateTime": "",
              }));
            }}
          />
          {errors["procedure.performedDateTime"] && (
            <span className="text-danger">
              {errors["procedure.performedDateTime"]}
            </span>
          )}
        </div>
        {isProcedurePartial && (
          <span className="text-danger">Please fill in this section.</span>
        )}
      </div>
      {!successInfo && (
        <button type="submit" className="button" disabled={loading}>
          {loading ? "Submitting…" : "Submit Record"}
        </button>
      )}
      {fieldLevelError && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2 className="text-danger">Warning:</h2>
            <p>{fieldLevelError}</p>
            <button
              className="close-button"
              onClick={() => setFieldLevelError("")}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
      )}
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
            <h2>Record stored on-chain!</h2>
            <p>Record ID:</p>
            <code className="mono">{successInfo.recordId}</code>
            {/* <p>IPFS Content ID:</p>
              <code className="mono">{successInfo.ipfsCid}</code> */}
            <p>Transaction:</p>
            <code className="mono">{successInfo.txHash}</code>
            {/* <p>Hash of the encrypted record:</p>
              <code className="mono">{successInfo.recordHash}</code> */}
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
