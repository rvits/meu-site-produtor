"use client";

import { useEffect, useState, useMemo } from "react";

const HORARIOS_PADRAO = [
  "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
];

interface BlockedSlot {
  id: string;
  data: string;
  hora: string;
}

export default function AdminControleAgendamentoPage() {
  // Data mínima: 1 de janeiro do ano atual
  const DATA_MINIMA = new Date(new Date().getFullYear(), 0, 1); // 1 de janeiro do ano atual

  const [dataBase, setDataBase] = useState(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    // Se o primeiro dia do mês atual for antes de 1 de janeiro, usar 1 de janeiro
    return primeiroDia < DATA_MINIMA ? DATA_MINIMA : primeiroDia;
  });

  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Função helper para verificar se uma data já passou (comparando apenas dia/mês/ano)
  const isDataPassada = (isoDate: string): boolean => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas a data
    
    const dataComparar = new Date(isoDate + "T00:00:00");
    dataComparar.setHours(0, 0, 0, 0);
    
    return dataComparar < hoje;
  };

  // Função helper para verificar se um horário já passou (comparando data + hora com agora)
  const isHorarioPassado = (isoDate: string, hora: string): boolean => {
    const agora = new Date();
    
    // Converter hora "HH:MM" para horas e minutos
    const [horas, minutos] = hora.split(":").map(Number);
    
    // Criar data/hora do agendamento
    const dataHoraAgendamento = new Date(isoDate + `T${hora}:00`);
    dataHoraAgendamento.setHours(horas, minutos, 0, 0);
    
    return dataHoraAgendamento < agora;
  };

  useEffect(() => {
    carregarDados();
  }, [dataBase]);

  async function carregarDados() {
    try {
      setLoading(true);
      const [resSlots, resAgendamentos] = await Promise.all([
        fetch("/api/admin/blocked-slots"),
        fetch("/api/admin/agendamentos"),
      ]);

      if (resSlots.ok) {
        const data = await resSlots.json();
        setBlockedSlots(data.slots || []);
      }

      if (resAgendamentos.ok) {
        const data = await resAgendamentos.json();
        setAgendamentos(data.agendamentos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados", err);
    } finally {
      setLoading(false);
    }
  }

  const horariosOcupadosPorDia: Record<string, Set<string>> = useMemo(() => {
    const ocupados: Record<string, Set<string>> = {};

    // Agendamentos aceitos/confirmados
    agendamentos
      .filter((a) => a.status === "aceito" || a.status === "confirmado")
      .forEach((a) => {
        const data = new Date(a.data);
        const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
        const horaStr = `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
        if (!ocupados[dataStr]) ocupados[dataStr] = new Set();
        ocupados[dataStr].add(horaStr);
      });

    // Horários bloqueados pelo admin
    blockedSlots.forEach((slot) => {
      if (!ocupados[slot.data]) ocupados[slot.data] = new Set();
      ocupados[slot.data].add(slot.hora);
    });

    return ocupados;
  }, [agendamentos, blockedSlots]);

  const ultimoDiaDoMes = new Date(
    dataBase.getFullYear(),
    dataBase.getMonth() + 1,
    0
  ).getDate();

  const primeiroDiaSemana = new Date(
    dataBase.getFullYear(),
    dataBase.getMonth(),
    1
  ).getDay();

  const dias: (number | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
  
  // Adicionar apenas dias a partir de 1 de janeiro
  for (let d = 1; d <= ultimoDiaDoMes; d++) {
    const dataDia = new Date(dataBase.getFullYear(), dataBase.getMonth(), d);
    // Só adicionar se a data for >= 1 de janeiro
    if (dataDia >= DATA_MINIMA) {
      dias.push(d);
    } else {
      dias.push(null); // Preencher com null para manter o layout
    }
  }

  // Função para obter status do dia
  function getDiaStatus(data: string): "livre" | "parcial" | "ocupado" {
    const ocupados = horariosOcupadosPorDia[data] || new Set<string>();
    const totalHorarios = HORARIOS_PADRAO.length;
    
    if (ocupados.size === 0) return "livre";
    if (ocupados.size === totalHorarios) return "ocupado";
    return "parcial";
  }

  // Função para normalizar hora (garantir formato HH:00)
  function normalizarHora(hora: string): string {
    if (!hora) return "00:00";
    if (hora.includes(":")) {
      const partes = hora.split(":");
      return `${partes[0].padStart(2, "0")}:00`;
    }
    return `${hora.padStart(2, "0")}:00`;
  }

  // Função para bloquear/desbloquear um horário
  async function toggleSlot(data: string, hora: string) {
    const horaNormalizada = normalizarHora(hora);
    console.log("[DEBUG] toggleSlot:", { data, hora, horaNormalizada, blockedSlots });
    
    // Verificar se existe (comparando com hora normalizada)
    const existe = blockedSlots.some((s) => {
      const sHoraNormalizada = normalizarHora(s.hora);
      return s.data === data && sHoraNormalizada === horaNormalizada;
    });

    console.log("[DEBUG] Slot existe?", existe);

    try {
      if (existe) {
        // Remover bloqueio
        const slot = blockedSlots.find((s) => {
          const sHoraNormalizada = normalizarHora(s.hora);
          return s.data === data && sHoraNormalizada === horaNormalizada;
        });
        
        console.log("[DEBUG] Slot encontrado para remover:", slot);
        
        if (slot) {
          const res = await fetch(`/api/admin/blocked-slots?id=${slot.id}`, {
            method: "DELETE",
          });
          
          console.log("[DEBUG] Resposta DELETE:", res.status, res.ok);
          
          if (res.ok) {
            setBlockedSlots((prev) => prev.filter((s) => s.id !== slot.id));
            await carregarDados();
            console.log("[DEBUG] Slot removido com sucesso");
          } else {
            const error = await res.json().catch(() => ({}));
            console.error("Erro ao remover slot:", error);
            alert(`Erro ao remover bloqueio: ${error.error || "Erro desconhecido"}`);
          }
        } else {
          console.warn("[DEBUG] Slot não encontrado para remover");
        }
      } else {
        // Adicionar bloqueio
        console.log("[DEBUG] Criando novo slot bloqueado...");
        const res = await fetch("/api/admin/blocked-slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, hora: horaNormalizada }),
        });
        
        console.log("[DEBUG] Resposta POST:", res.status, res.ok);
        
        if (res.ok) {
          const novoSlot = await res.json();
          console.log("[DEBUG] Novo slot criado:", novoSlot);
          setBlockedSlots((prev) => [...prev, novoSlot.slot]);
          await carregarDados();
          console.log("[DEBUG] Slot adicionado com sucesso");
        } else {
          const errorText = await res.text().catch(() => "Erro desconhecido");
          let error;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { error: errorText, message: errorText };
          }
          console.error("Erro ao criar slot - Status:", res.status);
          console.error("Erro ao criar slot - Resposta:", error);
          alert(`Erro ao bloquear horário (${res.status}): ${error.error || error.message || "Erro desconhecido"}`);
        }
      }
    } catch (err) {
      console.error("Erro ao alternar slot", err);
      alert(`Erro ao alterar horário: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }

  // Função para bloquear/desbloquear dia inteiro
  async function toggleDia(data: string) {
    const ocupados = horariosOcupadosPorDia[data] || new Set<string>();
    const slotsDoDia = blockedSlots.filter((s) => s.data === data);
    const horariosBloqueados = new Set(
      slotsDoDia.map((s) => normalizarHora(s.hora))
    );
    
    // Verificar se todos os horários estão bloqueados (comparando com horas normalizadas)
    const todosBloqueados = HORARIOS_PADRAO.every((h) => {
      const hNormalizada = normalizarHora(h);
      return horariosBloqueados.has(hNormalizada);
    });
    
    try {
      if (todosBloqueados) {
        // Desbloquear todos os horários do dia
        const promises = slotsDoDia.map((slot) =>
          fetch(`/api/admin/blocked-slots?id=${slot.id}`, {
            method: "DELETE",
          })
        );
        const results = await Promise.allSettled(promises);
        const errors = results.filter(r => r.status === "rejected");
        const failed = results.filter(r => 
          r.status === "fulfilled" && !r.value.ok
        );
        
        if (errors.length > 0 || failed.length > 0) {
          console.error("Alguns horários não puderam ser desbloqueados:", { errors, failed });
          const totalErrors = errors.length + failed.length;
          if (totalErrors < slotsDoDia.length) {
            alert(`${slotsDoDia.length - totalErrors} horário(s) desbloqueado(s) com sucesso. ${totalErrors} falharam.`);
          } else {
            alert("Erro ao desbloquear horários. Verifique o console para mais detalhes.");
          }
        } else {
          alert(`${slotsDoDia.length} horário(s) desbloqueado(s) com sucesso!`);
        }
        await carregarDados();
      } else {
        // Bloquear todos os horários do dia que não estão ocupados por agendamentos
        const horariosParaBloquear = HORARIOS_PADRAO.filter((h) => {
          const hNormalizada = normalizarHora(h);
          return !ocupados.has(h) && !horariosBloqueados.has(hNormalizada);
        });
        
        const promises = horariosParaBloquear.map(async (hora) => {
          try {
            const res = await fetch("/api/admin/blocked-slots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data, hora: normalizarHora(hora) }),
            });
            
            // Se for 409 (já existe), considerar como sucesso
            if (res.status === 409) {
              return { ok: true, status: 409, message: "Já existe" };
            }
            
            return res;
          } catch (err) {
            throw err;
          }
        });
        
        const results = await Promise.allSettled(promises);
        const errors = results.filter(r => r.status === "rejected");
        const failed = results.filter(r => 
          r.status === "fulfilled" && 
          r.value &&
          !r.value.ok && 
          r.value.status !== 409 // Ignorar 409 (já existe)
        );
        
        const sucessos = results.filter(r => 
          r.status === "fulfilled" && 
          r.value &&
          (r.value.ok || r.value.status === 409)
        );
        
        if (errors.length > 0 || failed.length > 0) {
          console.error("Alguns horários não puderam ser bloqueados:", { errors, failed });
          const totalErrors = errors.length + failed.length;
          if (sucessos.length > 0) {
            alert(`${sucessos.length} horário(s) bloqueado(s) com sucesso. ${totalErrors} falharam.`);
          } else {
            alert("Erro ao bloquear horários. Verifique o console para mais detalhes.");
          }
        } else {
          alert(`${horariosParaBloquear.length} horário(s) bloqueado(s) com sucesso!`);
        }
        await carregarDados();
      }
    } catch (err) {
      console.error("Erro ao alternar dia", err);
      alert(`Erro ao alterar dia: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }

  function isSlotBlocked(data: string, hora: string): boolean {
    const horaNormalizada = normalizarHora(hora);
    return blockedSlots.some((s) => {
      const sHoraNormalizada = normalizarHora(s.hora);
      return s.data === data && sHoraNormalizada === horaNormalizada;
    });
  }

  function isSlotOccupied(data: string, hora: string): boolean {
    const ocupados = horariosOcupadosPorDia[data] || new Set<string>();
    return ocupados.has(hora);
  }

  const handleMesAnterior = () => {
    setDataBase((prev) => {
      const novoMes = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      // Não permitir ir antes de 1 de janeiro
      return novoMes < DATA_MINIMA ? DATA_MINIMA : novoMes;
    });
    setSelectedDay(null);
  };

  // Verificar se pode ir para o mês anterior
  const podeIrMesAnterior = () => {
    const mesAnterior = new Date(dataBase.getFullYear(), dataBase.getMonth() - 1, 1);
    return mesAnterior >= DATA_MINIMA;
  };

  const handleProximoMes = () => {
    setDataBase((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const selectedDayData = selectedDay
    ? {
        date: new Date(selectedDay),
        ocupados: horariosOcupadosPorDia[selectedDay] || new Set<string>(),
        slotsBloqueados: blockedSlots.filter((s) => s.data === selectedDay),
      }
    : null;

  // Função para confirmar e publicar mudanças
  async function confirmarMudancas() {
    if (!confirm("Tem certeza que deseja confirmar e publicar todas as mudanças? Isso tornará os horários bloqueados visíveis na página pública de agendamento.")) {
      return;
    }

    try {
      setConfirmando(true);
      const res = await fetch("/api/admin/blocked-slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmar" }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Mudanças confirmadas e publicadas com sucesso!");
        await carregarDados(); // Recarregar dados
      } else {
        const error = await res.json();
        alert(error.error || "Erro ao confirmar mudanças. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao confirmar mudanças:", err);
      alert("Erro ao confirmar mudanças. Tente novamente.");
    } finally {
      setConfirmando(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando calendário...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Controle de Agendamento</h1>
          <p className="text-zinc-400">Clique em um dia para gerenciar seus horários.</p>
        </div>
        <button
          onClick={confirmarMudancas}
          disabled={confirmando}
          className="rounded-full bg-red-600 px-6 py-3 text-base font-semibold text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
        >
          {confirmando ? "Confirmando..." : "✓ Confirmar e Publicar Mudanças"}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handleMesAnterior}
            disabled={!podeIrMesAnterior()}
            className={`rounded-full border border-zinc-600 px-4 py-2 transition ${
              podeIrMesAnterior()
                ? "hover:border-red-500 hover:bg-zinc-700 cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            ◀ Anterior
          </button>

          <span className="text-xl font-semibold text-zinc-100">
            {dataBase.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>

          <button
            onClick={handleProximoMes}
            className="rounded-full border border-zinc-600 px-4 py-2 hover:border-red-500 hover:bg-zinc-700 transition"
          >
            Próximo ▶
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="py-2 text-center text-sm font-semibold text-zinc-400">
              {d}
            </div>
          ))}

          {dias.map((dia, idx) => {
            if (!dia) return <div key={idx} />;

            const isoDate = `${dataBase.getFullYear()}-${String(dataBase.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            
            // Verificar se a data é válida (>= 1 de janeiro)
            const dataDia = new Date(dataBase.getFullYear(), dataBase.getMonth(), dia);
            if (dataDia < DATA_MINIMA) {
              return <div key={idx} />;
            }
            
            const status = getDiaStatus(isoDate);
            
            // Verificar se a data já passou
            const diaPassado = isDataPassada(isoDate);

            let corDia = "border-green-600 bg-green-600/20 text-green-300 hover:bg-green-600/30";
            
            // VERMELHO: Se o dia já passou, sempre vermelho
            if (diaPassado) {
              corDia = "border-red-600 bg-red-600/30 text-red-300 opacity-60";
            } else if (status === "parcial") {
              corDia = "border-yellow-500 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30";
            } else if (status === "ocupado") {
              corDia = "border-red-600 bg-red-600/30 text-red-300 hover:bg-red-600/40";
            }

            return (
              <button
                key={isoDate}
                onClick={() => {
                  // Não permitir selecionar dias passados
                  if (!diaPassado) {
                    setSelectedDay(isoDate);
                  }
                }}
                disabled={diaPassado}
                className={`rounded-md border p-2 text-center text-sm transition ${
                  diaPassado 
                    ? "cursor-not-allowed opacity-60" 
                    : "cursor-pointer"
                } ${corDia} ${
                  selectedDay === isoDate ? "ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-800" : ""
                }`}
              >
                {dia}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-600/20 border border-green-600"></div>
            <span>Dia livre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500"></div>
            <span>Parcialmente ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-600/30 border border-red-600"></div>
            <span>Dia completo</span>
          </div>
        </div>
      </div>

      {/* MODAL DE HORÁRIOS DO DIA SELECIONADO */}
      {selectedDay && selectedDayData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-red-500 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">
                    Horários - {selectedDayData.date.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    {selectedDayData.ocupados.size} de {HORARIOS_PADRAO.length} horários ocupados
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-zinc-400 hover:text-red-400 text-2xl transition"
                >
                  ×
                </button>
              </div>

              {/* Botão para bloquear/desbloquear dia inteiro */}
              <div className="mb-6">
                <button
                  onClick={() => toggleDia(selectedDay)}
                  className={`w-full rounded-lg border px-4 py-3 font-semibold transition ${
                    selectedDayData.slotsBloqueados.length === HORARIOS_PADRAO.length
                      ? "border-green-600 bg-green-600/20 text-green-300 hover:bg-green-600/30"
                      : "border-red-600 bg-red-600/20 text-red-300 hover:bg-red-600/30"
                  }`}
                >
                  {selectedDayData.slotsBloqueados.length === HORARIOS_PADRAO.length
                    ? "Desbloquear todos os horários do dia"
                    : "Bloquear todos os horários do dia"}
                </button>
              </div>

              {/* Grid de horários */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {HORARIOS_PADRAO.map((hora) => {
                  const bloqueado = isSlotBlocked(selectedDay, hora);
                  const ocupadoPorAgendamento = selectedDayData.ocupados.has(hora) && !bloqueado;
                  const podeBloquear = !ocupadoPorAgendamento;
                  
                  // Verificar se o horário já passou
                  const horarioPassado = selectedDay ? isHorarioPassado(selectedDay, hora) : false;

                  return (
                    <button
                      key={hora}
                      onClick={() => {
                        // Não permitir bloquear/desbloquear horários passados
                        if (!horarioPassado && podeBloquear) {
                          toggleSlot(selectedDay, hora);
                        }
                      }}
                      disabled={ocupadoPorAgendamento || horarioPassado}
                      className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                        horarioPassado
                          ? "bg-red-900/60 text-red-200 border-red-700 cursor-not-allowed opacity-60"
                          : bloqueado
                          ? "bg-red-600 text-white border-red-500 hover:bg-red-500"
                          : ocupadoPorAgendamento
                          ? "bg-zinc-700 text-zinc-500 border-zinc-600 cursor-not-allowed"
                          : "bg-green-600/20 text-green-300 border-green-600 hover:bg-green-600/30"
                      }`}
                      title={
                        horarioPassado
                          ? "Horário já passou"
                          : bloqueado
                          ? "Clique para desbloquear"
                          : ocupadoPorAgendamento
                          ? "Ocupado por agendamento"
                          : "Clique para bloquear"
                      }
                    >
                      {hora}
                    </button>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-600/20 border border-green-600"></div>
                  <span>Disponível</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-600"></div>
                  <span>Bloqueado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-zinc-700"></div>
                  <span>Ocupado (agendamento)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
