import { ReactNode } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { getCurrentTenant } from '@/config/theme.config';

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { user } = useAuth();
  const isLoggedIn = user?.authenticated;

  // In development mode (localhost), allow access without authentication
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // For ATI tenant, allow access without authentication
  const isATI = getCurrentTenant() === 'ATI';

  if (isDevelopment || isATI) {
    console.log('Development mode or ATI tenant - bypassing authentication check');
    return children;
  }

  return isLoggedIn ? children : <Navigate to="/error" />;
};

export default PrivateRoute;