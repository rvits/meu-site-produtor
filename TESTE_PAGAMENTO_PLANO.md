# 🧪 Guia de Teste - Pagamento de Plano

## ✅ Correções Implementadas

### 1. **Metadata sendo passado corretamente**
- ✅ Metadata agora é enviado como JSON no `externalReference` (formato: `userId|JSON_METADATA`)
- ✅ Webhook lê metadata de múltiplas fontes

### 2. **Webhook robusto**
- ✅ Múltiplas formas de identificar usuário
- ✅ Verificação de plano existente antes de criar
- ✅ Logs detalhados em cada etapa

### 3. **Tratamento de erros**
- ✅ Erros não críticos não quebram o webhook
- ✅ Sempre retorna 200 para o Asaas

## 🧪 Como Testar

### Passo 1: Fazer Pagamento de Teste

1. Fazer login como usuário (ex: `raulvitorfs@gmail.com`)
2. Ir para `/planos`
3. Clicar em "Assinar este plano" (qualquer plano)
4. Preencher dados e escolher método de pagamento
5. Clicar em "Pagar"
6. Realizar pagamento no Asaas

### Passo 2: Verificar Logs do Servidor

Procure por estas mensagens nos logs:

```
[Asaas] Metadata completo: {...}
[Asaas Webhook] Evento recebido: {...}
[Asaas Webhook] Metadata processado: {...}
[Asaas Webhook] ✅ Novo plano criado e ativado: {id} {planId}
[Asaas Webhook] ✅✅✅ PLANO CRIADO COM SUCESSO ✅✅✅
```

### Passo 3: Verificar no Admin

1. Ir para `/admin/usuarios`
2. Buscar pelo email do usuário
3. Verificar se aparece na seção "Planos do Usuário"
4. Verificar status: deve estar "active"
5. Verificar datas: `startDate` e `endDate` devem estar preenchidas

### Passo 4: Verificar na Conta do Usuário

1. Fazer login como o usuário que fez o pagamento
2. Ir para `/minha-conta`
3. Verificar seção "Meus Planos"
4. Deve aparecer o plano ativo
5. Verificar seção "Meus Cupons"
6. Deve aparecer os cupons de serviços gerados

### Passo 5: Verificar Banco de Dados

```sql
-- Verificar pagamento
SELECT * FROM Payment 
WHERE userId = 'user_id' 
ORDER BY createdAt DESC 
LIMIT 1;

-- Verificar plano
SELECT * FROM UserPlan 
WHERE userId = 'user_id' 
ORDER BY createdAt DESC 
LIMIT 1;

-- Verificar assinatura (se criada)
SELECT * FROM Subscription 
WHERE userId = 'user_id';

-- Verificar cupons gerados
SELECT * FROM Coupon 
WHERE userPlanId = 'user_plan_id' 
ORDER BY createdAt DESC;
```

## 🚨 Se Não Funcionar

### Verificar Webhook no Asaas

1. Acesse: https://www.asaas.com (ou sandbox)
2. Vá em **Integrações → Webhooks**
3. Verifique se está configurado:
   - URL: `https://seu-tunnel.loca.lt/api/webhooks/asaas`
   - Eventos: `PAYMENT_RECEIVED`
4. Verifique logs de webhook no Asaas

### Verificar Metadata no Pagamento

No painel do Asaas:
1. Vá em **Cobranças**
2. Abra o pagamento
3. Verifique campo **"Referência Externa"**
4. Deve conter: `userId|{"tipo":"plano",...}`

### Verificar Logs do Servidor

Procure por:
- `❌ Não foi possível identificar o usuário` - Problema com externalReference
- `❌ FALHA AO CRIAR PLANO - DADOS INCOMPLETOS` - Metadata não foi lido
- `Erro ao processar pagamento no banco` - Erro no banco de dados

### Testar Webhook Manualmente

Você pode simular um webhook usando curl ou Postman:

```bash
POST http://localhost:3000/api/webhooks/asaas
Content-Type: application/json

{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_test_123",
    "status": "RECEIVED",
    "value": 197.00,
    "customer": "cus_xxx",
    "externalReference": "user_id|{\"tipo\":\"plano\",\"userId\":\"user_id\",\"planId\":\"bronze\",\"modo\":\"mensal\",\"planName\":\"Plano Bronze\",\"amount\":\"197.00\",\"paymentMethod\":\"pix\",\"billingDay\":28}",
    "description": "Plano Bronze - Mensal"
  }
}
```

## 📊 O Que Deve Acontecer

1. ✅ Pagamento criado no Asaas
2. ✅ Webhook recebido pelo servidor
3. ✅ Pagamento registrado no banco (`Payment`)
4. ✅ Plano criado no banco (`UserPlan`)
5. ✅ Assinatura recorrente criada (`Subscription`)
6. ✅ Cupons de serviços gerados (`Coupon`)
7. ✅ Email de confirmação enviado
8. ✅ Plano aparece no admin
9. ✅ Plano aparece em "Minha Conta"

## 🔍 Debug

Se algo não funcionar, verifique nesta ordem:

1. **Logs do servidor** - Procure por `[Asaas Webhook]`
2. **Webhook no Asaas** - Verifique se foi chamado
3. **Banco de dados** - Verifique se registros foram criados
4. **Metadata** - Verifique se está sendo passado corretamente

## ✅ Checklist Final

- [ ] Pagamento processado no Asaas
- [ ] Webhook recebido (ver logs)
- [ ] Pagamento registrado no banco
- [ ] Plano criado no banco
- [ ] Plano aparece no admin
- [ ] Plano aparece em "Minha Conta"
- [ ] Cupons gerados
- [ ] Email enviado
- [ ] Assinatura recorrente criada (se aplicável)
