"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export function useUnreadPlanCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    async function fetchUnreadCount() {
      try {
        // Adicionar timestamp para evitar cache
        const timestamp = new Date().getTime();
        const res = await fetch(`/api/meus-dados?t=${timestamp}`, {
          credentials: "include",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          const planos = data.planos || [];
          // Contar planos ativos que não foram lidos (readAt é null)
          // Um plano é considerado "confirmado" quando tem status "active" e foi criado recentemente
          const unread = planos.filter((p: any) => {
            const isActive = p.status === "active" && p.ativo === true;
            return isActive && !p.readAt;
          });
          const total = unread.length;
          console.log(`[useUnreadPlanCount] 📊 Total de planos confirmados não lidos: ${total}`);
          setUnreadCount(total);
        } else {
          setUnreadCount(0);
        }
      } catch (error) {
        console.error("Erro ao buscar contagem de planos não lidos:", error);
        setUnreadCount(0);
      }
    }

    // Buscar imediatamente
    fetchUnreadCount();

    // Escutar evento de atualização (disparado quando planos são marcados como lidos)
    const handlePlanUpdated = () => {
      console.log("[useUnreadPlanCount] 🔔 Evento plan-updated recebido, atualizando contagem...");
      fetchUnreadCount();
    };
    
    window.addEventListener("plan-updated", handlePlanUpdated);

    // Atualizar a cada 1 minuto
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("plan-updated", handlePlanUpdated);
    };
  }, [user]);

  return unreadCount;
}
