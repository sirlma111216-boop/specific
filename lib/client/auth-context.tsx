"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { clientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { apiFetch } from "./api";
import type { Role } from "@/lib/types";

export interface Profile {
  uid: string;
  role: Role;
  email: string;
  needsOnboarding: boolean;
  klass: {
    classId: string;
    schoolYear: number;
    schoolName: string;
    grade: string;
    classNumber: string;
    teacherName: string;
  } | null;
  student: { studentNumber: number; studentName: string } | null;
}

interface AuthState {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured();
  // 설정이 없으면 기다릴 것이 없으므로 처음부터 로딩이 끝난 상태로 시작한다.
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (current: User | null) => {
    if (!current) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await apiFetch<Profile>("/api/me"));
      setError(null);
    } catch (err) {
      setProfile(null);
      setError(err instanceof Error ? err.message : "계정 정보를 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(clientAuth(), async (current) => {
      setUser(current);
      await loadProfile(current);
      setLoading(false);
    });
  }, [configured, loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile(clientAuth().currentUser);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await fbSignOut(clientAuth());
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ configured, loading, user, profile, error, refresh, signOut }),
    [configured, loading, user, profile, error, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
