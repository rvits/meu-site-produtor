"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export function useUnreadAppointmentCount() {
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
          const agendamentos = data.agendamentos || [];
          // Contar agendamentos confirmados/aceitos que não foram lidos (readAt é null)
          // Um agendamento é considerado "confirmado" quando tem status "aceito" ou "confirmado" e tem pagamento aprovado
          const unread = agendamentos.filter((a: any) => {
            const isConfirmed = (a.status === "aceito" || a.status === "confirmado") && a.pagamento?.status === "approved";
            return isConfirmed && !a.readAt;
          });
          const total = unread.length;
          console.log(`[useUnreadAppointmentCount] 📊 Total de agendamentos confirmados não lidos: ${total}`);
          setUnreadCount(total);
        } else {
          setUnreadCount(0);
        }
      } catch (error) {
        console.error("Erro ao buscar contagem de agendamentos não lidos:", error);
        setUnreadCount(0);
      }
    }

    // Buscar imediatamente
    fetchUnreadCount();

    // Escutar evento de atualização (disparado quando agendamentos são marcados como lidos)
    const handleAppointmentUpdated = () => {
      console.log("[useUnreadAppointmentCount] 🔔 Evento appointment-updated recebido, atualizando contagem...");
      fetchUnreadCount();
    };
    
    window.addEventListener("appointment-updated", handleAppointmentUpdated);

    // Atualizar a cada 1 minuto
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("appointment-updated", handleAppointmentUpdated);
    };
  }, [user]);

  return unreadCount;
}
