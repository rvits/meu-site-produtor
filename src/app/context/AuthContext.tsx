"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: number;
  nome: string;
  email: string;
  foto?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<boolean>;
  registro: (nome: string, email: string, senha: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// --------------------------------------
// Helper para validar se algo "parece" um User
// --------------------------------------
function isValidUser(u: any): u is User {
  if (!u || typeof u !== "object") return false;
  if (typeof u.id !== "number") return false;
  if (typeof u.nome !== "string") return false;
  if (typeof u.email !== "string") return false;
  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // --------------------------------------
  // Carregar usuário salvo com try/catch
  // --------------------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem("thouse_user");
      if (!saved) {
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(saved);
      if (isValidUser(parsed)) {
        setUser(parsed);
      } else {
        console.warn(
          "[Auth] Dados inválidos em localStorage.thouse_user, limpando..."
        );
        localStorage.removeItem("thouse_user");
      }
    } catch (e) {
      console.error("[Auth] Erro ao ler localStorage.thouse_user:", e);
      localStorage.removeItem("thouse_user");
    } finally {
      setLoading(false);
    }
  }, []);

  // --------------------------------------
  // LOGIN
  // --------------------------------------
  async function login(email: string, senha: string): Promise<boolean> {
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, senha }),
      });

      if (!r.ok) {
        console.error("Login falhou. Status:", r.status);
        alert("Falha no login. Verifique e-mail/senha.");
        return false;
      }

      const data: any = await r.json();
      console.log("[Auth] Resposta crua do login:", data);

      // A API pode devolver { user: {...} } OU diretamente {id, nome, email}
      const candidate = data?.user ?? data;

      if (!isValidUser(candidate)) {
        console.error(
          "Resposta de login sem dados válidos de usuário:",
          data
        );
        alert("Login respondeu sem os dados do usuário.");
        return false;
      }

      setUser(candidate);
      localStorage.setItem("thouse_user", JSON.stringify(candidate));
      return true;
    } catch (e) {
      console.error("Erro inesperado no login:", e);
      alert("Erro inesperado ao fazer login.");
      return false;
    }
  }

  // --------------------------------------
  // REGISTRO
  // --------------------------------------
  async function registro(
    nome: string,
    email: string,
    senha: string
  ): Promise<boolean> {
    try {
      const r = await fetch("/api/registro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nome, email, senha }),
      });

      if (!r.ok) {
        console.error("Registro falhou. Status:", r.status);
        alert("Registro falhou. Verifique os dados (e-mail pode já existir).");
        return false;
      }

      const data: any = await r.json();
      console.log("[Auth] Resposta crua do registro:", data);

      const candidate = data?.user ?? data;

      if (!isValidUser(candidate)) {
        console.error(
          "Resposta de registro sem dados válidos de usuário:",
          data
        );
        alert("Registro respondeu sem os dados do usuário.");
        return false;
      }

      setUser(candidate);
      localStorage.setItem("thouse_user", JSON.stringify(candidate));
      return true;
    } catch (e) {
      console.error("Erro inesperado no registro:", e);
      alert("Erro inesperado ao fazer registro.");
      return false;
    }
  }

  // --------------------------------------
  // LOGOUT
  // --------------------------------------
  function logout() {
    setUser(null);
    localStorage.removeItem("thouse_user");
  }

  // --------------------------------------
  // UPDATE PROFILE
  // --------------------------------------
  function updateUser(data: Partial<User>) {
    setUser((prev) => {
      const updated = prev ? { ...prev, ...data } : null;
      if (updated) {
        localStorage.setItem("thouse_user", JSON.stringify(updated));
      }
      return updated;
    });
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, registro, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
