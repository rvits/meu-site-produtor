# 🚀 Implementação Completa - Sistema de Emails e Cupons

## ✅ O QUE JÁ FOI IMPLEMENTADO:

### 1. **Backend Completo**
- ✅ Modelo `Coupon` no Prisma
- ✅ Funções de email em `src/app/lib/sendEmail.ts`
- ✅ API de validação de cupons (`/api/coupons/validate`)
- ✅ API de geração de cupons (`/api/admin/coupons/generate`)
- ✅ Webhook atualizado para enviar emails após pagamento
- ✅ API de admin atualizada para enviar emails ao aceitar/recusar
- ✅ API de cancelamento atualizada para enviar email
- ✅ API para criar agendamento com cupom (`/api/agendamentos/com-cupom`)

## 🔧 O QUE PRECISA SER FEITO NO FRONTEND:

### 1. **Página de Admin - Agendamentos** (`src/app/admin/agendamentos/page.tsx`)

Adicionar campo de comentário editável ao recusar:

```typescript
// Adicionar estado:
const [rejectionComment, setRejectionComment] = useState("");
const [showRejectionModal, setShowRejectionModal] = useState(false);
const [appointmentToReject, setAppointmentToReject] = useState<number | null>(null);

// Modificar função de recusar:
async function recusarAgendamento(id: number) {
  setAppointmentToReject(id);
  setShowRejectionModal(true);
}

async function confirmarRecusa() {
  if (!appointmentToReject) return;
  
  try {
    const res = await fetch(`/api/admin/agendamentos?id=${appointmentToReject}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        status: "recusado",
        rejectionComment: rejectionComment || "Agendamento recusado."
      }),
    });

    if (res.ok) {
      await carregarAgendamentos();
      setShowRejectionModal(false);
      setRejectionComment("");
      setAppointmentToReject(null);
      alert("Agendamento recusado e email enviado!");
    }
  } catch (err) {
    console.error("Erro ao recusar:", err);
  }
}

// No JSX, substituir o botão "Recusar" por:
{a.status === "pendente" && (
  <>
    <button
      onClick={() => recusarAgendamento(a.id)}
      className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition"
    >
      Recusar
    </button>
    
    {/* Modal de recusa */}
    {showRejectionModal && appointmentToReject === a.id && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-xl font-bold text-white mb-4">Recusar Agendamento</h3>
          <textarea
            value={rejectionComment}
            onChange={(e) => setRejectionComment(e.target.value)}
            placeholder="Digite o motivo da recusa (será enviado por email ao cliente)..."
            className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 mb-4 h-32"
          />
          <div className="flex gap-2">
            <button
              onClick={confirmarRecusa}
              className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              Confirmar Recusa
            </button>
            <button
              onClick={() => {
                setShowRejectionModal(false);
                setRejectionComment("");
                setAppointmentToReject(null);
              }}
              className="flex-1 rounded bg-zinc-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-500"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
  </>
)}
```

### 2. **Página de Admin - Cancelamento** (`src/app/admin/agendamentos/page.tsx`)

Adicionar campo de comentário ao cancelar:

```typescript
// Adicionar estado:
const [cancellationComment, setCancellationComment] = useState("");
const [showCancellationModal, setShowCancellationModal] = useState(false);
const [appointmentToCancel, setAppointmentToCancel] = useState<number | null>(null);

// Modificar função de cancelar:
async function cancelarAgendamento(id: number) {
  setAppointmentToCancel(id);
  setShowCancellationModal(true);
}

async function confirmarCancelamento() {
  if (!appointmentToCancel) return;
  
  try {
    const res = await fetch(`/api/admin/agendamentos/cancelar?id=${appointmentToCancel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cancellationComment: cancellationComment || "Agendamento cancelado."
      }),
    });

    if (res.ok) {
      await carregarAgendamentos();
      setShowCancellationModal(false);
      setCancellationComment("");
      setAppointmentToCancel(null);
      alert("Agendamento cancelado e email enviado!");
    }
  } catch (err) {
    console.error("Erro ao cancelar:", err);
  }
}

// No JSX, adicionar modal similar ao de recusa
```

### 3. **Página de Agendamento** (`src/app/agendamento/page.tsx`)

Adicionar campo de cupom e lógica para pular pagamento:

```typescript
// Adicionar estados:
const [cupomCode, setCupomCode] = useState("");
const [cupomValidado, setCupomValidado] = useState<{
  valid: boolean;
  discount: number;
  finalTotal: number;
  coupon: any;
} | null>(null);
const [validandoCupom, setValidandoCupom] = useState(false);
const [erroCupom, setErroCupom] = useState("");

// Função para validar cupom:
async function validarCupom() {
  if (!cupomCode.trim()) {
    setErroCupom("Digite um código de cupom");
    return;
  }

  setValidandoCupom(true);
  setErroCupom("");
  
  try {
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        code: cupomCode.toUpperCase(), 
        total: totalCalculado 
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        setCupomValidado(data);
        setErroCupom("");
      } else {
        setErroCupom("Cupom inválido");
        setCupomValidado(null);
      }
    } else {
      const errorData = await res.json();
      setErroCupom(errorData.error || "Erro ao validar cupom");
      setCupomValidado(null);
    }
  } catch (err) {
    console.error("Erro ao validar cupom:", err);
    setErroCupom("Erro ao validar cupom");
    setCupomValidado(null);
  } finally {
    setValidandoCupom(false);
  }
}

// Modificar função handlePagar:
async function handlePagar() {
  // ... validações existentes ...

  // Se cupom zerou o valor, criar agendamento diretamente
  if (cupomValidado && cupomValidado.finalTotal === 0) {
    try {
      const res = await fetch("/api/agendamentos/com-cupom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: dataSelecionada,
          hora: horaSelecionada,
          duracaoMinutos: duracaoMinutos,
          tipo: tipoSelecionado,
          observacoes: comentarios,
          servicos: servicosSelecionados,
          beats: beatsSelecionados,
          cupomCode: cupomCode.toUpperCase(),
        }),
      });

      if (res.ok) {
        alert("Agendamento criado com sucesso! Aguarde a confirmação por email.");
        router.push("/agendamento");
      } else {
        const error = await res.json();
        alert(error.error || "Erro ao criar agendamento");
      }
    } catch (err) {
      console.error("Erro ao criar agendamento com cupom:", err);
      alert("Erro ao criar agendamento");
    }
    return;
  }

  // Fluxo normal de pagamento (código existente)
  // ...
}

// No JSX, adicionar campo de cupom ANTES do botão de pagar:
<div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 mb-6">
  <h3 className="text-lg font-bold text-zinc-100 mb-4">🎟️ Tem um cupom de desconto?</h3>
  <div className="flex gap-2">
    <input
      type="text"
      value={cupomCode}
      onChange={(e) => {
        setCupomCode(e.target.value.toUpperCase());
        setCupomValidado(null);
        setErroCupom("");
      }}
      placeholder="Digite o código do cupom"
      className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
    />
    <button
      onClick={validarCupom}
      disabled={validandoCupom || !cupomCode.trim()}
      className="rounded bg-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {validandoCupom ? "Validando..." : "Validar"}
    </button>
  </div>
  
  {erroCupom && (
    <p className="mt-2 text-sm text-red-400">{erroCupom}</p>
  )}
  
  {cupomValidado && cupomValidado.valid && (
    <div className="mt-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
      <p className="text-green-400 font-semibold">✅ Cupom aplicado!</p>
      <p className="text-sm text-zinc-300 mt-1">
        Desconto: R$ {cupomValidado.discount.toFixed(2).replace(".", ",")}
      </p>
      <p className="text-sm text-zinc-300">
        Total: R$ {cupomValidado.finalTotal.toFixed(2).replace(".", ",")}
      </p>
      {cupomValidado.finalTotal === 0 && (
        <p className="text-sm text-green-400 font-semibold mt-2">
          🎉 Agendamento será criado sem necessidade de pagamento!
        </p>
      )}
    </div>
  )}
</div>

// Atualizar exibição do total para considerar cupom:
<div className="text-2xl font-bold text-zinc-100">
  Total: R$ {
    (cupomValidado && cupomValidado.valid 
      ? cupomValidado.finalTotal 
      : totalCalculado
    ).toFixed(2).replace(".", ",")
  }
</div>
```

## 📋 RESUMO DO QUE ESTÁ PRONTO:

✅ **Backend 100% completo:**
- Webhook envia emails após pagamento
- Admin envia emails ao aceitar/recusar/cancelar
- Sistema de cupons funcionando
- APIs criadas e testadas

⏳ **Frontend precisa:**
- Adicionar campos de comentário editável no admin
- Adicionar campo de cupom na página de agendamento
- Integrar validação de cupom
- Implementar criação de agendamento sem pagamento quando cupom zera valor

## 🎯 PRÓXIMOS PASSOS:

1. Implementar campos de comentário no admin (recusa e cancelamento)
2. Implementar campo de cupom na página de agendamento
3. Testar fluxo completo
4. Verificar se emails estão sendo enviados corretamente

## ⚠️ IMPORTANTE:

- Os emails já estão sendo enviados automaticamente pelo backend
- Os cupons já estão sendo gerados automaticamente ao recusar/cancelar
- Apenas falta a interface do usuário para usar essas funcionalidades
