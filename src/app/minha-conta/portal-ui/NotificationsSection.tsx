"use client";

/**
 * Portal do Cliente — Notificações.
 * Timeline cronológica derivada exclusivamente de dados existentes:
 * pagamentos aprovados, entregas, cupons emitidos, agendamentos
 * confirmados, planos e respostas do FAQ.
 */

import { useMemo } from "react";
import {
  EmptyState,
  Section,
  Timeline,
  TimelineItemData,
  formatDateTime,
} from "@/components/design-system";
import { deliveryDisplayName } from "@/app/lib/delivery-url-validation";
import type { PortalData } from "./types";
import { isRefundFamilyCoupon } from "./helpers";

interface Notif {
  date: number;
  item: TimelineItemData;
}

export function buildNotifications(data: PortalData): TimelineItemData[] {
  const notifs: Notif[] = [];

  for (const p of data.pagamentos ?? []) {
    if (p.status === "approved") {
      notifs.push({
        date: new Date(p.createdAt).getTime(),
        item: {
          key: `pay-${p.id}`,
          title: "Pagamento aprovado",
          description: `R$ ${p.amount.toFixed(2).replace(".", ",")}${
            p.paymentMethod ? ` · ${p.paymentMethod}` : ""
          }`,
          meta: formatDateTime(p.createdAt),
          state: "done",
          intent: "success",
          icon: "credit-card",
        },
      });
    }
  }

  for (const a of data.agendamentos) {
    if (a.status === "aceito" || a.status === "confirmado") {
      notifs.push({
        date: new Date(a.createdAt ?? a.data).getTime(),
        item: {
          key: `apt-${a.id}`,
          title: "Agendamento confirmado",
          description: `${a.tipo} · ${formatDateTime(a.data)}`,
          meta: a.createdAt ? formatDateTime(a.createdAt) : undefined,
          state: "done",
          intent: "info",
          icon: "calendar",
        },
      });
    }
    if (a.status === "concluido") {
      notifs.push({
        date: new Date(a.data).getTime(),
        item: {
          key: `apt-done-${a.id}`,
          title: "Serviço concluído",
          description: a.tipo,
          meta: formatDateTime(a.data),
          state: "done",
          intent: "success",
          icon: "check-circle",
        },
      });
    }
    for (const e of a.entregas ?? []) {
      if (e.deliveredAt) {
        notifs.push({
          date: new Date(e.deliveredAt).getTime(),
          item: {
            key: `delivery-${e.id}`,
            title: "Arquivo disponível",
            description: deliveryDisplayName(e.deliveryAudioUrl),
            meta: formatDateTime(e.deliveredAt),
            state: "done",
            intent: "success",
            icon: "download",
          },
        });
      }
    }
    if (a.refundProcessedAt) {
      notifs.push({
        date: new Date(a.refundProcessedAt).getTime(),
        item: {
          key: `refund-${a.id}`,
          title:
            a.cancelRefundOption === "cupom"
              ? "Cupom de remarcação emitido"
              : "Reembolso solicitado",
          description: a.cancelCouponCode ?? a.tipo,
          meta: formatDateTime(a.refundProcessedAt),
          state: "done",
          intent: "info",
          icon: a.cancelRefundOption === "cupom" ? "ticket" : "wallet",
        },
      });
    }
  }

  for (const c of data.cupons) {
    if (c.createdAt) {
      notifs.push({
        date: new Date(c.createdAt).getTime(),
        item: {
          key: `coupon-${c.id}`,
          title: isRefundFamilyCoupon(c) ? "Cupom de reembolso emitido" : "Cupom emitido",
          description: c.code,
          meta: formatDateTime(c.createdAt),
          state: "done",
          intent: "warning",
          icon: "ticket",
        },
      });
    }
  }

  for (const pl of data.planos) {
    notifs.push({
      date: new Date(pl.startDate).getTime(),
      item: {
        key: `plan-${pl.id}`,
        title: pl.ativo ? "Plano ativado" : `Plano ${pl.status === "cancelled" ? "cancelado" : "registrado"}`,
        description: `${pl.planName} · ${pl.modo === "mensal" ? "Mensal" : "Anual"}`,
        meta: formatDateTime(pl.startDate),
        state: "done",
        intent: pl.ativo ? "success" : "neutral",
        icon: "box",
      },
    });
  }

  for (const f of data.faqQuestions) {
    if (f.status === "respondida" && f.answeredAt) {
      notifs.push({
        date: new Date(f.answeredAt).getTime(),
        item: {
          key: `faq-${f.id}`,
          title: "Pergunta respondida",
          description: f.question,
          meta: formatDateTime(f.answeredAt),
          state: "done",
          intent: "info",
          icon: "chat",
        },
      });
    }
  }

  notifs.sort((a, b) => b.date - a.date);
  return notifs.map((n) => n.item);
}

export function NotificationsSection({ data }: { data: PortalData }) {
  const items = useMemo(() => buildNotifications(data), [data]);

  return (
    <Section
      title="Notificações"
      icon="bell"
      description="Linha do tempo com tudo que aconteceu na sua conta, do mais recente ao mais antigo."
    >
      {items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Nenhuma notificação por enquanto"
          description="Pagamentos, entregas, cupons e confirmações aparecerão aqui."
        />
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <Timeline items={items} />
        </div>
      )}
    </Section>
  );
}
