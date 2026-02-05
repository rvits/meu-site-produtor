# 🔧 Correção: Limite de externalReference do Asaas

## ❌ Problema

O Asaas limita o campo `externalReference` a **100 caracteres**, mas estávamos tentando passar o metadata completo como JSON stringificado, resultando em mais de 200 caracteres.

**Erro:**
```
Property [externalReference] of class [{1}] with value [...] exceeds the maximum size of [100]
```

## ✅ Solução Implementada

### 1. **Armazenar Metadata em PaymentMetadata**

Antes de criar o checkout no Asaas, salvamos o metadata completo em uma tabela `PaymentMetadata`:

```typescript
const paymentMetadata = await prisma.paymentMetadata.create({
  data: {
    userId: user.id,
    metadata: JSON.stringify(metadataCompleto),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
  },
});
```

### 2. **Passar Apenas userId no externalReference**

No `createCheckout`, passamos apenas o `userId` (máximo 36 caracteres para UUID):

```typescript
externalReference: user.id // Apenas userId
```

### 3. **Buscar Metadata no Webhook**

No webhook, buscamos o metadata usando o `userId` do `externalReference`:

```typescript
const paymentMetadata = await prisma.paymentMetadata.findFirst({
  where: {
    userId: userId,
    expiresAt: { gt: new Date() },
  },
  orderBy: { createdAt: 'desc' },
});

if (paymentMetadata) {
  metadata = JSON.parse(paymentMetadata.metadata);
  // Atualizar asaasId para referência futura
  await prisma.paymentMetadata.update({
    where: { id: paymentMetadata.id },
    data: { asaasId: paymentId },
  });
}
```

## 📋 Arquivos Modificados

1. **`src/app/lib/payment-providers.ts`**
   - Validação de `externalReference` máximo 100 caracteres
   - Passa apenas `userId` no `externalReference`

2. **`src/app/api/test-payment/route.ts`**
   - Salva metadata em `PaymentMetadata` antes de criar checkout
   - Passa apenas `userId` no metadata

3. **`src/app/api/asaas/checkout/route.ts`**
   - Salva metadata em `PaymentMetadata` antes de criar checkout
   - Passa apenas `userId` no metadata

4. **`src/app/api/webhooks/asaas/route.ts`**
   - Busca metadata de `PaymentMetadata` usando `userId`
   - Fallback para outros métodos se necessário

## 🧪 Como Testar

1. Fazer pagamento de teste de plano
2. Verificar logs:
   - `[Test Payment] PaymentMetadata criado: {id}`
   - `[Asaas Webhook] Metadata encontrado no PaymentMetadata`
3. Verificar se plano é criado corretamente

## ✅ Status

- ✅ Correção implementada
- ✅ Validação de limite adicionada
- ✅ Sistema de fallback mantido
- ⚠️ Prisma Client precisa ser regenerado (`npx prisma generate`)
