import React, { useState, useEffect, useCallback } from 'react';
import {
  isAdminAuthenticated,
  verifyAdminPassword,
  loginAdminWithShortcut,
  verifyStoredAdminSession,
  clearAdminToken
} from '../services/api';

export interface UseAdminSessionResult {
  adminAuthed: boolean;
  adminPasswordInput: string;
  setAdminPasswordInput: React.Dispatch<React.SetStateAction<string>>;
  adminAuthError: string | null;
  setAdminAuthError: React.Dispatch<React.SetStateAction<string | null>>;
  isVerifyingAdmin: boolean;
  handleAdminLoginSubmit: (e: React.FormEvent) => Promise<void>;
  handleAdminLock: () => void;
  handleSwitchToAdminWithCredentials: (sbdInput?: string, codeInput?: string) => Promise<void>;
}

/**
 * Encapsulates Admin authentication state, server-side session verification,
 * login/lock transitions, and shortcut elevation cleanly outside App.tsx.
 */
export function useAdminSession(
  setActiveView: React.Dispatch<React.SetStateAction<'student' | 'admin'>>
): UseAdminSessionResult {
  const [adminAuthed, setAdminAuthed] = useState<boolean>(() => isAdminAuthenticated());
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);

  useEffect(() => {
    verifyStoredAdminSession()
      .then(valid => setAdminAuthed(valid))
      .catch(() => {});
  }, []);

  const handleAdminLoginSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput.trim() || isVerifyingAdmin) return;
    setIsVerifyingAdmin(true);
    setAdminAuthError(null);
    const res = await verifyAdminPassword(adminPasswordInput.trim());
    setIsVerifyingAdmin(false);
    if (res.success) {
      setAdminAuthed(true);
      setAdminPasswordInput('');
    } else {
      setAdminAuthError(res.error || 'Incorrect Admin password.');
    }
  }, [adminPasswordInput, isVerifyingAdmin]);

  const handleAdminLock = useCallback(() => {
    clearAdminToken();
    setAdminAuthed(false);
    setAdminPasswordInput('');
    setAdminAuthError(null);
    setActiveView('student');
  }, [setActiveView]);

  const handleSwitchToAdminWithCredentials = useCallback(async (sbdInput?: string, codeInput?: string) => {
    if (sbdInput && codeInput) {
      const res = await loginAdminWithShortcut(sbdInput, codeInput);
      if (res.success) {
        setAdminAuthed(true);
        setAdminAuthError(null);
      }
    }
    setActiveView('admin');
  }, [setActiveView]);

  return {
    adminAuthed,
    adminPasswordInput,
    setAdminPasswordInput,
    adminAuthError,
    setAdminAuthError,
    isVerifyingAdmin,
    handleAdminLoginSubmit,
    handleAdminLock,
    handleSwitchToAdminWithCredentials
  };
}
