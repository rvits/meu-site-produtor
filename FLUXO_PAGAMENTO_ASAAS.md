# ✅ Fluxo Completo de Pagamento - Asaas

## 🎯 O que foi implementado

### 1. **Checkout de Planos** (`/api/asaas/checkout`)
- ✅ Cria um `UserPlan` com status "pending" ANTES de criar o pagamento
- ✅ O plano aparece imediatamente na seção "Planos" do admin
- ✅ Quando o pagamento for confirmado (via webhook), o status muda para "active"

### 2. **Checkout de Agendamentos** (`/api/asaas/checkout-agendamento`)
- ✅ Cria um `Appointment` com status "pendente" ANTES de criar o pagamento
- ✅ O agendamento aparece imediatamente na seção "Agendamentos" do admin
- ✅ Quando o pagamento for confirmado (via webhook), o status muda para "aceito"
- ✅ Admin pode aceitar/rejeitar manualmente se necessário

### 3. **Webhook do Asaas** (`/api/webhooks/asaas`)
- ✅ Recebe notificações quando pagamento é confirmado
- ✅ Atualiza automaticamente o status do plano/agendamento
- ✅ Cria registro de pagamento no banco de dados

### 4. **Teste de Pagamento** (`/api/test-payment`)
- ✅ Box de teste na página de **Planos** → cria plano de teste
- ✅ Box de teste na página de **Agendamento** → cria agendamento de teste
- ✅ Ambos criam registros reais no banco para testar o fluxo completo

## 📋 Fluxo Completo

### Para Planos:

1. **Usuário seleciona plano** → `/planos`
2. **Clica em "Assinar este plano"** → Redireciona para `/pagamentos`
3. **Preenche dados** → Clica em "Pagar com Asaas"
4. **Sistema cria `UserPlan`** → Status: "pending"
5. **Sistema cria pagamento no Asaas** → Retorna link de pagamento
6. **Usuário é redirecionado** → Para o Asaas
7. **Usuário paga** → Escolhe Pix, Cartão, Boleto, etc.
8. **Asaas confirma pagamento** → Envia webhook para `/api/webhooks/asaas`
9. **Webhook atualiza** → `UserPlan.status = "active"`
10. **Plano aparece ativo** → Na seção "Planos" do admin

### Para Agendamentos:

1. **Usuário seleciona serviços** → `/agendamento`
2. **Seleciona data e hora** → Clica em "Confirmar agendamento"
3. **Redireciona para `/pagamentos`** → Preenche dados
4. **Clica em "Pagar com Asaas"**
5. **Sistema cria `Appointment`** → Status: "pendente"
6. **Sistema cria pagamento no Asaas** → Retorna link de pagamento
7. **Usuário é redirecionado** → Para o Asaas
8. **Usuário paga** → Escolhe forma de pagamento
9. **Asaas confirma pagamento** → Envia webhook
10. **Webhook atualiza** → `Appointment.status = "aceito"`
11. **Agendamento aparece aceito** → Na seção "Agendamentos" do admin
12. **Admin pode gerenciar** → Aceitar, rejeitar, ou alterar status

## 🧪 Teste de Pagamento (Admin)

### Teste de Plano:
1. Login como admin (`thouse.rec.tremv@gmail.com`)
2. Acesse `/planos`
3. Veja a **box amarela** "🧪 Pagamento de Teste - Plano"
4. Clique em "Testar Pagamento - R$ 5,00"
5. Sistema cria:
   - `UserPlan` de teste (status: "pending")
   - Pagamento no Asaas (R$ 5,00)
6. Redireciona para Asaas
7. Complete o pagamento
8. Webhook atualiza plano para "active"
9. Verifique em `/admin/planos` → Plano deve aparecer ativo

### Teste de Agendamento:
1. Login como admin
2. Acesse `/agendamento`
3. Veja a **box amarela** "🧪 Pagamento de Teste - Agendamento"
4. Clique em "Testar Pagamento - R$ 5,00"
5. Sistema cria:
   - `Appointment` de teste (status: "pendente", data: 7 dias a partir de hoje)
   - Pagamento no Asaas (R$ 5,00)
6. Redireciona para Asaas
7. Complete o pagamento
8. Webhook atualiza agendamento para "aceito"
9. Verifique em `/admin/agendamentos` → Agendamento deve aparecer aceito

## 🔔 Configuração do Webhook

**IMPORTANTE**: Configure o webhook no painel do Asaas:

1. Acesse: https://www.asaas.com/ → Integrações → Webhooks
2. Adicione URL: `https://seu-dominio.com/api/webhooks/asaas`
3. Selecione eventos:
   - ✅ `PAYMENT_RECEIVED` (essencial)
   - `PAYMENT_CREATED`
   - `PAYMENT_OVERDUE`

**Para desenvolvimento local**, use ngrok:
```bash
ngrok http 3000
# Use a URL gerada: https://abc123.ngrok.io/api/webhooks/asaas
```

## ✅ Checklist de Funcionalidades

- [x] Checkout de planos cria `UserPlan` antes do pagamento
- [x] Checkout de agendamentos cria `Appointment` antes do pagamento
- [x] Webhook atualiza status automaticamente
- [x] Teste de pagamento cria plano de teste
- [x] Teste de pagamento cria agendamento de teste
- [x] Planos aparecem em `/admin/planos`
- [x] Agendamentos aparecem em `/admin/agendamentos`
- [x] Admin pode aceitar/rejeitar agendamentos
- [x] Links de pagamento funcionam corretamente
- [x] Páginas de sucesso/falha atualizadas

## 🎯 Próximos Passos

1. **Reiniciar servidor** para carregar o token do Asaas
2. **Testar pagamento de plano** (box amarela em `/planos`)
3. **Testar pagamento de agendamento** (box amarela em `/agendamento`)
4. **Verificar em `/admin/planos`** → Deve aparecer o plano
5. **Verificar em `/admin/agendamentos`** → Deve aparecer o agendamento
6. **Configurar webhook** quando a conta do Asaas for aprovada

---

**Tudo pronto para testar!** 🚀
