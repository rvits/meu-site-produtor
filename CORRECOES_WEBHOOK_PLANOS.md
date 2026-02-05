# 🔧 Correções no Webhook de Planos - Asaas

## ❌ Problema Identificado

O pagamento do plano estava sendo processado no Asaas, mas o site não estava registrando o plano porque:

1. **Metadata não estava sendo passado corretamente** para o Asaas
2. **Webhook não estava conseguindo ler o metadata** do pagamento
3. **Falta de logs detalhados** para debug
4. **Não havia fallback** para identificar usuário se externalReference falhasse

## ✅ Correções Implementadas

### 1. **Passagem de Metadata Melhorada** (`src/app/lib/payment-providers.ts`)

- ✅ Metadata agora é passado como JSON stringificado no `externalReference`
- ✅ Formato: `userId|JSON_METADATA` para garantir que sempre temos o userId
- ✅ Logs detalhados do metadata sendo enviado

### 2. **Webhook Robusto** (`src/app/api/webhooks/asaas/route.ts`)

- ✅ **Múltiplas formas de ler metadata:**
  - Direto de `payment.metadata` (objeto)
  - Parse de `payment.metadata` (string JSON)
  - Extração de `externalReference` (formato `userId|JSON_METADATA`)
  - Fallback da descrição do pagamento

- ✅ **Identificação de usuário melhorada:**
  - Primeiro tenta `externalReference`
  - Se falhar, busca pelo `customerId` do Asaas
  - Busca usuário pelo email do customer

- ✅ **Verificação de plano existente:**
  - Verifica se já existe plano ativo antes de criar
  - Atualiza plano existente em vez de criar duplicado

- ✅ **Logs detalhados:**
  - Log de todo o payment recebido
  - Log do metadata processado
  - Log de cada etapa do processamento
  - Logs de erro mais informativos

### 3. **Tratamento de Erros Melhorado**

- ✅ Erros não críticos não quebram o webhook
- ✅ Logs detalhados de erros para debug
- ✅ Sempre retorna 200 para o Asaas (evita reenvios)

## 🔍 Como Verificar se Está Funcionando

### 1. Verificar Logs do Webhook

Após fazer um pagamento de teste, verifique os logs do servidor:

```
[Asaas Webhook] Evento recebido: {...}
[Asaas Webhook] Processando: {...}
[Asaas Webhook] Metadata processado: {...}
[Asaas Webhook] ✅ Novo plano criado e ativado: {id} {planId}
```

### 2. Verificar no Banco de Dados

```sql
-- Verificar pagamentos
SELECT * FROM Payment WHERE asaasId = 'pay_xxx' ORDER BY createdAt DESC;

-- Verificar planos do usuário
SELECT * FROM UserPlan WHERE userId = 'user_id' ORDER BY createdAt DESC;

-- Verificar assinaturas
SELECT * FROM Subscription WHERE userId = 'user_id';
```

### 3. Verificar na Interface

- **Admin → Usuários**: Deve aparecer o plano na lista de planos do usuário
- **Minha Conta**: Deve aparecer o plano ativo na seção "Meus Planos"

## 🚨 Se Ainda Não Funcionar

### Verificar Webhook no Asaas

1. Acesse o painel do Asaas
2. Vá em **Integrações → Webhooks**
3. Verifique se o webhook está configurado corretamente
4. Verifique os logs de webhook no Asaas

### Verificar Logs do Servidor

Procure por:
- `[Asaas Webhook]` nos logs
- Erros relacionados a `metadata`
- Erros relacionados a `userId`

### Testar Manualmente

Você pode simular um webhook manualmente:

```bash
curl -X POST http://localhost:3000/api/webhooks/asaas \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_test",
      "status": "RECEIVED",
      "value": 197.00,
      "customer": "cus_xxx",
      "externalReference": "user_id|{\"tipo\":\"plano\",\"userId\":\"user_id\",\"planId\":\"bronze\",\"modo\":\"mensal\",\"planName\":\"Plano Bronze\",\"amount\":\"197.00\"}",
      "description": "Plano Bronze - Mensal",
      "metadata": {
        "tipo": "plano",
        "userId": "user_id",
        "planId": "bronze",
        "modo": "mensal",
        "planName": "Plano Bronze",
        "amount": "197.00"
      }
    }
  }'
```

## 📋 Próximos Passos

1. ✅ Testar pagamento de plano novamente
2. ✅ Verificar se aparece no admin
3. ✅ Verificar se aparece em "Minha Conta"
4. ✅ Verificar se cupons foram gerados
5. ✅ Verificar se emails foram enviados
