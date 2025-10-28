import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  isUsername,
  isPassword,
} from "../utils/validators/register-validators";
import "../styling/RegisterPage.css";
import logo from "../images/logo.png";
import axiosInstance from "../api";

export default function RegisterPatientPage() {
  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    addr: "",
    birthDate: "",
    gender: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({
    username: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
    password: "",
    confirmPassword: "",
    consent: "",
  });
  const [successInfo, setSuccessInfo] = useState(null);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const errs = {
      username: "",
      firstName: "",
      lastName: "",
      birthDate: "",
      gender: "",
      password: "",
      confirmPassword: "",
      consent: "",
    };

    if (!formData.username) {
      errs.username = "Username is required.";
    } else if (!isUsername(formData.username)) {
      errs.username = "Invalid username format.";
    }

    if (!formData.firstName) {
      errs.firstName = "First name is required.";
    }
    if (!formData.lastName) {
      errs.lastName = "Last name is required.";
    }

    if (!formData.birthDate) {
      errs.birthDate = "Birth date is required.";
    }

    if (!formData.gender) {
      errs.gender = "Please select a gender.";
    }

    if (!formData.password) {
      errs.password = "Password is required.";
    } else if (!isPassword(formData.password)) {
      errs.password = "Invalid password format.";
    }

    if (!formData.confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }

    if (!consent) {
      errs.consent = "You have to agree before registering.";
    }

    setErrors(errs);
    return Object.values(errs).every((e) => e === "");
  };

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    if (name === "consent") {
      setConsent(checked);
    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
    setServerError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError("");
    setLoading(true);
    try {
      const { data } = await axiosInstance.post(
        "/auth/users/patients",
        formData
      );
      setSuccessInfo({ address: data.address });
    } catch (err) {
      setServerError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <img src={logo} alt="HealthChain logo" className="login-logo" />
        <h1 className="register-title">Register as Patient</h1>

        <form noValidate onSubmit={handleSubmit} className="register-form">
          <label htmlFor="username">Username</label>
          <div className={`form-group ${errors.username ? "error" : ""}`}>
            <div className="input-container">
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            {errors.username && (
              <span className="text-danger">{errors.username}</span>
            )}
          </div>

          <label htmlFor="firstName">First Name</label>
          <div className={`form-group ${errors.firstName ? "error" : ""}`}>
            <div className="input-container">
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            {errors.firstName && (
              <span className="text-danger">{errors.firstName}</span>
            )}
          </div>

          <label htmlFor="lastName">Last Name</label>
          <div className={`form-group ${errors.lastName ? "error" : ""}`}>
            <div className="input-container">
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
            {errors.lastName && (
              <span className="text-danger">{errors.lastName}</span>
            )}
          </div>

          <label htmlFor="addr">Address</label>
          <div className="form-group">
            <div className="input-container">
              <input
                id="addr"
                name="addr"
                type="text"
                value={formData.addr}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row birth-gender-row">
            <div className={`form-group ${errors.birthDate ? "error" : ""}`}>
              <label htmlFor="birthDate">Birth Date</label>
              <input
                id="birthDate"
                name="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={handleChange}
              />
              {errors.birthDate && (
                <span className="text-danger">{errors.birthDate}</span>
              )}
            </div>
            <div
              className={`form-group gender-group ${
                errors.gender ? "error" : ""
              }`}
            >
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && (
                <span className="text-danger">{errors.gender}</span>
              )}
            </div>
          </div>

          <label htmlFor="password">Password</label>
          <div
            className={`form-group password-group ${
              errors.password ? "error" : ""
            }`}
          >
            <div className="input-container">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="toggle-button"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <span className="text-danger">{errors.password}</span>
            )}
          </div>

          <label htmlFor="confirmPassword">Confirm Password</label>
          <div
            className={`form-group password-group ${
              errors.confirmPassword ? "error" : ""
            }`}
          >
            <div className="input-container">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="toggle-button"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="text-danger">{errors.confirmPassword}</span>
            )}
          </div>

          <div
            className={`form-group checkbox-group ${
              errors.consent ? "error" : ""
            }`}
          >
            <label htmlFor="consent">
              By registering, I consent to the processing of my personal data
              for clustering and analysis purposes.
            </label>
            <input
              id="consent"
              name="consent"
              type="checkbox"
              checked={consent}
              onChange={handleChange}
            />
          </div>
          {errors.consent && (
            <span className="text-danger">{errors.consent}</span>
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

          <button type="submit" className="submit-button" disabled={loading}>
            Register
          </button>
        </form>

        <p className="login-text">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
      {successInfo && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h2>Registration successful!</h2>
            <p>Your blockchain address is:</p>
            <code className="mono">{successInfo.address}</code>
            <p>This is your unique ID on our blockchain.</p>
            <button className="continue-btn" onClick={() => navigate("/login")}>
              Continue to login
            </button>
          </div>
        </div>
      )}
      {loading && (
        <div className="dialog-overlay">
          <div className="dialog-box flex-center">
            <div className="spinner" aria-label="Loading" />
            <p>Wait for registration to complete…</p>
          </div>
        </div>
      )}
    </div>
  );
}
