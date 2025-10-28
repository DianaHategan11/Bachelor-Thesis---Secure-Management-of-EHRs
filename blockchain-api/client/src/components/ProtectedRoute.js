import React from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function ProtectedRoute({ children, roles }) {
  const { token, user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/login" replace />;
  return children;
}
