"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { getCurrentUser, isAuthenticated, login as apiLogin, logout as apiLogout, signup as apiSignup } from "@/lib/auth";
import type { LoginRequest, SignupRequest, TokenResponse, UserResponse } from "@/lib/auth";
import { subscribeToSessionExpired } from "@/lib/auth/session-events";

type AuthContextType = {
  user: UserResponse | null;
  isLoading: boolean;
  isSessionExpired: boolean;
  dismissSessionExpired: () => void;
  login: (data: LoginRequest) => Promise<TokenResponse>;
  signup: (data: SignupRequest) => Promise<TokenResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const dismissSessionExpired = () => {
    setIsSessionExpired(false);
  };

  const refreshUser = async () => {
    if (!isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsSessionExpired(false);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      apiLogout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return subscribeToSessionExpired(() => {
      setUser(null);
      setIsSessionExpired(true);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    void refreshUser(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const login = async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const res = await apiLogin(data);
      await refreshUser();
      setIsSessionExpired(false);
      return res;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const signup = async (data: SignupRequest) => {
    setIsLoading(true);
    try {
      const res = await apiSignup(data);
      await refreshUser();
      setIsSessionExpired(false);
      return res;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
    setIsSessionExpired(false);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isSessionExpired, dismissSessionExpired, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
