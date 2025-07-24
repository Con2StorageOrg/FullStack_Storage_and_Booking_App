import { Navigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
  requiredOrganization?: string;
  requireSuperVera?: boolean;
}

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  requiredOrganization,
}: ProtectedRouteProps) => {
  const { authLoading } = useAuth(); // wait for supabase auth to finish
  const { loading: rolesLoading, hasAnyRole, isSuperVera } = useRoles(); // roles from the new schema

  // Use a state variable to track if access check has been performed
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Only perform the check once when data is loaded
    if (!authLoading && !rolesLoading && !accessChecked) {
      // NEW SYSTEM: Check if user has role in JWT-based roles across all organizations
      const hasNewRole = hasAnyRole(allowedRoles, requiredOrganization);

      // Allow access if user has required role OR is SuperVera (development bypass)
      const userHasAccess = hasNewRole || isSuperVera;

      setHasAccess(userHasAccess);
      setAccessChecked(true);
    }
  }, [
    authLoading,
    rolesLoading,
    allowedRoles,
    hasAnyRole,
    isSuperVera,
    requiredOrganization,
    accessChecked,
  ]);

  // Show loading state while authentication or checking is in progress
  if (authLoading || rolesLoading || !accessChecked) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoaderCircle className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // Check access and redirect if necessary
  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User has access, render children
  return <>{children}</>;
};

export default ProtectedRoute;
