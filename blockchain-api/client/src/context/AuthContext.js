import React, { createContext, useReducer, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import axiosInstance from "../api";
import { useNavigate } from "react-router-dom";

const storedToken = localStorage.getItem("token");

const initialState = {
  token: storedToken,
  user: storedToken ? jwtDecode(storedToken) : null,
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "LOGIN_START":
      return { ...state, loading: true, error: null };
    case "LOGIN_SUCCESS":
      return {
        ...state,
        token: action.payload,
        user: jwtDecode(action.payload),
        loading: false,
      };
    case "LOGOUT":
      return { token: null, user: null, loading: false, error: null };
    case "SET_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const nav = useNavigate();

  useEffect(() => {
    if (state.token) {
      try {
        dispatch({ type: "LOGIN_SUCCESS", payload: state.token });
      } catch {
        dispatch({ type: "LOGOUT" });
      }
    }
  }, []);

  const login = async (username, password) => {
    dispatch({ type: "LOGIN_START" });

    try {
      const res = await axiosInstance.post("/auth/users/login", {
        username,
        password,
      });
      const { token, role } = res.data;

      dispatch({ type: "LOGIN_SUCCESS", payload: token });
      localStorage.setItem("token", token);

      if (role === "PATIENT") nav("/patient/dashboard");
      else if (role === "DOCTOR") nav("/doctor/dashboard");
      else nav("/");
    } catch (err) {
      let msg = "Login failed.";
      if (err.response) {
        const { status, data } = err.response;
        if (status === 400)
          msg = data.error || "Please fill in all the fields.";
        else if (status === 401 || status === 404)
          msg = data.error || "Invalid credentials.";
        else msg = data.error || `Error ${status}`;
      } else {
        msg = "Network error. Please try again.";
      }
      dispatch({ type: "SET_ERROR", payload: msg });
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post("/auth/users/logout");
    } catch {
      console.warn();
    }
    localStorage.removeItem("token");
    dispatch({ type: "LOGOUT" });
    nav("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        token: state.token,
        user: state.user,
        loading: state.loading,
        error: state.error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
