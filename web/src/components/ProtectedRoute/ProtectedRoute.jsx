import { Navigate, Outlet } from "react-router-dom";
import Config from "../../utils/data.jsx";

const ProtectedRoute = () => {
  const { token } = Config();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
