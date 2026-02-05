# 🧪 Como Testar o Sistema de Emails e Cupons

## ✅ Teste 1: Email após Pagamento Confirmado

1. **Fazer um pagamento de teste** na página `/agendamento`
2. **Completar o pagamento** no Asaas (PIX, cartão, etc.)
3. **Aguardar alguns segundos** para o webhook processar
4. **Verificar emails:**
   - Usuário deve receber: "✅ Pagamento Confirmado!"
   - THouse deve receber: "💰 Novo Pagamento Recebido"

## ✅ Teste 2: Email quando Agendamento é Aceito

1. **Acessar** `/admin/agendamentos`
2. **Aceitar** um agendamento pendente
3. **Verificar email** do usuário: "✅ Agendamento Confirmado!"

## ✅ Teste 3: Email quando Agendamento é Recusado

1. **Acessar** `/admin/agendamentos`
2. **Recusar** um agendamento pendente
3. **Digitar comentário** (quando implementado no frontend)
4. **Verificar email** do usuário: "Agendamento Recusado" com cupom

## ✅ Teste 4: Email quando Agendamento é Cancelado

1. **Acessar** `/admin/agendamentos`
2. **Cancelar** um agendamento aceito
3. **Digitar comentário** (quando implementado no frontend)
4. **Verificar email** do usuário: "Agendamento Cancelado" com cupom

## ✅ Teste 5: Sistema de Cupons

1. **Obter código de cupom** (gerado automaticamente ao recusar/cancelar)
2. **Acessar** `/agendamento`
3. **Digitar código** no campo de cupom
4. **Validar cupom**
5. **Se valor zerar**, criar agendamento sem pagamento
6. **Se valor não zerar**, aplicar desconto no total

## 🔍 Verificar Logs

No terminal do servidor, você verá:
- `[Asaas Webhook] Emails de confirmação enviados com sucesso`
- `[Admin] Email de aceitação enviado para...`
- `[Admin] Email de recusa enviado para...`
- `[Admin] Cupom gerado para agendamento...`

## ⚠️ Problemas Comuns

1. **Email não enviado:**
   - Verificar se `SUPPORT_EMAIL` e `SUPPORT_EMAIL_PASSWORD` estão configurados no `.env`
   - Verificar logs do servidor para erros

2. **Cupom não funciona:**
   - Verificar se cupom não foi usado antes
   - Verificar se cupom não expirou
   - Verificar logs da API `/api/coupons/validate`

3. **Webhook não processa:**
   - Verificar se webhook está configurado no Asaas
   - Verificar URL do webhook (deve apontar para `/api/webhooks/asaas`)
