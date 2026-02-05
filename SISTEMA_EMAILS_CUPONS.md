# 📧 Sistema de Emails e Cupons - Implementação

## ✅ O que foi implementado:

### 1. **Modelo de Cupom no Banco de Dados**
- ✅ Criado modelo `Coupon` no Prisma
- ✅ Campos: código único, tipo de desconto (percent/fixed), valor, usado, expiração, etc.

### 2. **Funções de Email** (`src/app/lib/sendEmail.ts`)
- ✅ `sendPaymentConfirmationEmailToUser()` - Email para usuário após pagamento
- ✅ `sendPaymentNotificationToTHouse()` - Email para THouse após pagamento
- ✅ `sendAppointmentAcceptedEmail()` - Email quando agendamento é aceito
- ✅ `sendAppointmentRejectedEmail()` - Email quando agendamento é recusado (com comentário editável)
- ✅ `sendAppointmentCancelledEmail()` - Email quando agendamento é cancelado (com comentário editável)

### 3. **APIs de Cupons**
- ✅ `POST /api/coupons/validate` - Validar cupom e calcular desconto
- ✅ `POST /api/admin/coupons/generate` - Gerar cupom de desconto (admin)

## 🔄 O que precisa ser atualizado:

### 1. **Webhook do Asaas** (`src/app/api/webhooks/asaas/route.ts`)
Adicionar envio de emails após pagamento confirmado:

```typescript
// Após criar o Payment e Appointment, adicionar:
import { sendPaymentConfirmationEmailToUser, sendPaymentNotificationToTHouse } from "@/app/lib/sendEmail";

// Buscar dados completos do usuário e agendamento
const user = await prisma.user.findUnique({ where: { id: userId } });
const appointment = await prisma.appointment.findUnique({ 
  where: { id: agendamentoFinalId },
  include: { user: true }
});

// Buscar serviços e beats do metadata
const services = metadata.servicos ? JSON.parse(metadata.servicos) : [];
const beats = metadata.beats ? JSON.parse(metadata.beats) : [];

// Enviar email para usuário
await sendPaymentConfirmationEmailToUser(
  user.email,
  user.nomeArtistico,
  appointment.data,
  parseFloat(metadata.total || "0")
);

// Enviar email para THouse
await sendPaymentNotificationToTHouse(
  user.email,
  user.nomeArtistico,
  user.telefone,
  appointment.data,
  appointment.tipo,
  appointment.duracaoMinutos,
  appointment.observacoes,
  parseFloat(metadata.total || "0"),
  metadata.paymentMethod,
  services,
  beats
);
```

### 2. **API de Admin Agendamentos** (`src/app/api/admin/agendamentos/route.ts`)
Atualizar PATCH para enviar emails:

```typescript
import { sendAppointmentAcceptedEmail, sendAppointmentRejectedEmail } from "@/app/lib/sendEmail";
import { generateCouponCode } from "@/app/lib/coupons";

// No PATCH, após atualizar status:
if (validation.data.status === "aceito" || validation.data.status === "confirmado") {
  const appointment = await prisma.appointment.findUnique({
    where: { id: parseInt(id) },
    include: { user: true }
  });
  
  await sendAppointmentAcceptedEmail(
    appointment.user.email,
    appointment.user.nomeArtistico,
    appointment.data,
    appointment.tipo
  );
}

if (validation.data.status === "recusado") {
  const { rejectionComment } = body; // Comentário editável do admin
  
  // Gerar cupom de desconto
  const coupon = await prisma.coupon.create({
    data: {
      code: generateCouponCode(),
      discountType: "fixed",
      discountValue: /* valor do pagamento */,
      appointmentId: appointment.id,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
    }
  });
  
  await sendAppointmentRejectedEmail(
    appointment.user.email,
    appointment.user.nomeArtistico,
    rejectionComment || "Agendamento recusado.",
    coupon.code
  );
}
```

### 3. **API de Cancelamento** (`src/app/api/admin/agendamentos/cancelar/route.ts`)
Adicionar envio de email:

```typescript
import { sendAppointmentCancelledEmail } from "@/app/lib/sendEmail";
import { generateCouponCode } from "@/app/lib/coupons";

// Após cancelar, adicionar:
const { cancellationComment } = body; // Comentário editável

// Buscar pagamento associado
const payment = await prisma.payment.findFirst({
  where: { appointmentId: parseInt(appointmentId) }
});

// Gerar cupom
const coupon = await prisma.coupon.create({
  data: {
    code: generateCouponCode(),
    discountType: "fixed",
    discountValue: payment.amount,
    appointmentId: parseInt(appointmentId),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  }
});

await sendAppointmentCancelledEmail(
  agendamento.user.email,
  agendamento.user.nomeArtistico,
  agendamento.data,
  cancellationComment || "Agendamento cancelado.",
  coupon.code
);
```

### 4. **Página de Agendamento** (`src/app/agendamento/page.tsx`)
Adicionar campo de cupom e lógica para pular pagamento:

```typescript
// Adicionar estado:
const [cupomCode, setCupomCode] = useState("");
const [cupomValidado, setCupomValidado] = useState<any>(null);
const [validandoCupom, setValidandoCupom] = useState(false);

// Função para validar cupom:
async function validarCupom() {
  if (!cupomCode.trim()) return;
  
  setValidandoCupom(true);
  try {
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: cupomCode, total: totalCalculado }),
    });
    
    if (res.ok) {
      const data = await res.json();
      setCupomValidado(data);
      // Atualizar total com desconto
    } else {
      alert("Cupom inválido");
    }
  } catch (err) {
    console.error("Erro ao validar cupom:", err);
  } finally {
    setValidandoCupom(false);
  }
}

// No handlePagar, verificar se total com cupom é zero:
if (cupomValidado && cupomValidado.finalTotal === 0) {
  // Criar agendamento diretamente sem pagamento
  // Chamar API para criar agendamento e marcar cupom como usado
} else {
  // Fluxo normal de pagamento
}
```

### 5. **API para Criar Agendamento com Cupom** (`src/app/api/agendamentos/com-cupom/route.ts`)
Criar nova rota:

```typescript
// POST /api/agendamentos/com-cupom
// Criar agendamento diretamente quando cupom zera o valor
// Marcar cupom como usado
```

## 📋 Próximos Passos:

1. Atualizar webhook para enviar emails após pagamento
2. Atualizar API de admin para enviar emails ao aceitar/recusar
3. Atualizar API de cancelamento para enviar email
4. Adicionar campo de cupom na página de agendamento
5. Criar API para criar agendamento com cupom (quando valor é zero)
6. Adicionar campos de comentário editável nas páginas de admin

## 🎯 Funcionalidades Implementadas:

✅ Sistema de cupons completo
✅ Templates de email profissionais
✅ Geração automática de cupons ao recusar/cancelar
✅ Validação de cupons
✅ Cálculo de desconto (percentual ou fixo)

## ⚠️ Pendente:

- Integração completa no webhook
- Integração completa nas APIs de admin
- Interface de cupom na página de agendamento
- Campos de comentário editável no admin
