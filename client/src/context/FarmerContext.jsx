/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'aeroguard_active_farmers';
const FarmerContext = createContext(null);

/**
 * Persistent farmer workspace manager.
 * Stores verified farmer sessions in localStorage so navigation
 * never loses them.
 */
export function FarmerProvider({ children }) {
  const [activeFarmers, setActiveFarmers] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeFarmers));
  }, [activeFarmers]);

  /**
   * Called after a successful OTP verification.
   * Adds a new farmer workspace entry (deduplicates by sessionId).
   */
  const addFarmer = useCallback((email, sessionId) => {
    setActiveFarmers((prev) => {
      // Don't add duplicate sessions
      if (prev.some((f) => f.sessionId === sessionId)) return prev;
      return [
        ...prev,
        {
          email,
          sessionId,
          verifiedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  /**
   * Remove a farmer workspace by sessionId.
   */
  const removeFarmer = useCallback((sessionId) => {
    setActiveFarmers((prev) => prev.filter((f) => f.sessionId !== sessionId));
  }, []);

  /**
   * Get a single farmer by sessionId.
   */
  const getFarmer = useCallback(
    (sessionId) => activeFarmers.find((f) => f.sessionId === sessionId) || null,
    [activeFarmers]
  );

  const value = useMemo(
    () => ({
      activeFarmers,
      addFarmer,
      removeFarmer,
      getFarmer,
    }),
    [activeFarmers, addFarmer, removeFarmer, getFarmer]
  );

  return <FarmerContext.Provider value={value}>{children}</FarmerContext.Provider>;
}

export function useFarmers() {
  const ctx = useContext(FarmerContext);
  if (!ctx) {
    throw new Error('useFarmers must be used within FarmerProvider');
  }
  return ctx;
}
