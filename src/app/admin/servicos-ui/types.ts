/**
 * GO-03A — Tipos de UI do painel de serviços (somente leitura da API existente).
 * Espelham a resposta de GET /api/admin/servicos. Nenhuma regra de negócio aqui.
 */

export interface AdminAppointment {
  id: number;
  data: string;
  status: string;
  tipo: string;
  observacoes?: string | null;
}

export interface AdminPaymentInfo {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
}

export interface AdminCouponInfo {
  id: string;
  code: string;
  type: string;
  status: string;
}

export interface AdminService {
  id: string;
  tipo: string;
  description?: string | null;
  observacoes?: string | null;
  status: string;
  acceptedAt?: string | null;
  appointmentId: number | null;
  appointment: AdminAppointment | null;
  deliveryAudioUrl?: string | null;
  deliveryAudioFormat?: string | null;
  payment?: AdminPaymentInfo | null;
  coupons?: AdminCouponInfo[];
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
  updatedAt?: string | null;
}

export type BoardVariant = "gerais" | "selecionados";
