import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks";
import { getUserById } from "../store/slices/usersSlice";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router-dom";

export const UserProfileLoader = () => {
  const dispatch = useAppDispatch();
  const { user, authLoading } = useAuth();

  const fetchedOnce = useRef(false);
  const location = useLocation();

  // Skip fetching on auth pages
  const isAuthPage =
    location.pathname.includes("/login") ||
    location.pathname.includes("/signup");

  useEffect(() => {
    // Wait for authLoading to finish and only fetch once
    if (!authLoading && user?.id && !fetchedOnce.current && !isAuthPage) {
      dispatch(getUserById(user.id));
      fetchedOnce.current = true;
    }
  }, [user?.id, authLoading, dispatch, isAuthPage]);

  return null;
};
