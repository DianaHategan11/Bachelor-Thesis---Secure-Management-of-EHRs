import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import {
  isUsername,
  isPassword,
} from "../utils/validators/register-validators";
import "../styling/LoginPage.css";
import logo from "../images/logo.png";

export default function LoginPage() {
  const { login, error: authError } = useAuth();

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ username: "", password: "" });
  const [showAuthErr, setShowAuthErr] = useState(false);

  useEffect(() => {
    if (authError) setShowAuthErr(true);
  }, [authError]);

  const validate = () => {
    const errs = { username: "", password: "" };

    if (!form.username) {
      errs.username = "Username is required.";
    }
    // else if (!isUsername(form.username)) {
    //   errs.username = "Invalid username format.";
    // }

    if (!form.password) {
      errs.password = "Password is required.";
    }
    // else if (!isPassword(form.password)) {
    //   errs.password = "Invalid password format.";
    // }

    setErrors(errs);
    return Object.values(errs).every((e) => e === "");
  };

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    login(form.username, form.password);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src={logo} alt="HealthChain logo" className="login-logo" />

        <form noValidate onSubmit={handleSubmit} className="login-form">
          <label htmlFor="username">Username</label>
          <div className={`form-group ${errors.username ? "error" : ""}`}>
            <div className="input-container">
              <input
                id="username"
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
              />
            </div>
            {errors.username && (
              <span className="text-danger">{errors.username}</span>
            )}
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
                value={form.password}
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

          {showAuthErr && authError && (
            <div className="dialog-overlay">
              <div className="dialog-box">
                <h2 className="text-danger">Server Error:</h2>
                <p>{authError}</p>
                <button
                  className="close-button"
                  onClick={() => setShowAuthErr(false)}
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
            </div>
          )}

          <button type="submit" className="submit-button">
            Log In
          </button>
        </form>

        <p className="register-text">
          Don't have an account? Register as{" "}
          <Link to="/register/patient">Patient</Link> or{" "}
          <Link to="/register/doctor">Doctor</Link>
        </p>
      </div>
    </div>
  );
}
