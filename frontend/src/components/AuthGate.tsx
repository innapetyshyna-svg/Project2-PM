"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { fetchMe, login, logout } from "@/lib/auth";

export const AuthGate = () => {
  // undefined while the session check is in flight, null when signed out
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetchMe().then(setUsername);
  }, []);

  const handleLogin = async (name: string, password: string) => {
    const ok = await login(name, password);
    if (ok) {
      setUsername(name);
    }
    return ok;
  };

  const handleLogout = async () => {
    await logout();
    setUsername(null);
  };

  if (username === undefined) {
    return null;
  }
  if (username === null) {
    return <LoginForm onLogin={handleLogin} />;
  }
  return <KanbanBoard onLogout={handleLogout} />;
};
