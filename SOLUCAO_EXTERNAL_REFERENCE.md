# ✅ Solução: Limite de externalReference do Asaas

## 🔴 Problema Identificado

O Asaas retornou erro:
```
Property [externalReference] exceeds the maximum size of [100]
```

O `externalReference` estava com mais de 200 caracteres porque tentávamos passar o metadata completo como JSON.

## ✅ Solução Implementada

### 1. **Armazenar Metadata em PaymentMetadata**

Antes de criar o checkout, salvamos o metadata completo em `PaymentMetadata`:

```typescript
const paymentMetadata = await prisma.paymentMetadata.create({
  data: {
    userId: user.id,
    metadata: JSON.stringify(metadataCompleto),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
});
```

### 2. **Passar Apenas userId no externalReference**

Agora passamos apenas o `userId` (máximo 36 caracteres):

```typescript
externalReference: user.id // ✅ Apenas userId
```

### 3. **Webhook Busca Metadata**

No webhook, buscamos o metadata usando o `userId`:

```typescript
const paymentMetadata = await prisma.paymentMetadata.findFirst({
  where: { userId: userId, expiresAt: { gt: new Date() } },
  orderBy: { createdAt: 'desc' },
});
```

## ⚠️ Ação Necessária

**Regenerar o Prisma Client:**

```bash
npx prisma generate
```

Se der erro de permissão, feche o servidor Next.js e tente novamente.

## 📋 Arquivos Modificados

1. ✅ `src/app/lib/payment-providers.ts` - Validação de limite
2. ✅ `src/app/api/test-payment/route.ts` - Salva metadata antes
3. ✅ `src/app/api/asaas/checkout/route.ts` - Salva metadata antes
4. ✅ `src/app/api/webhooks/asaas/route.ts` - Busca metadata

## 🧪 Teste

Após regenerar o Prisma Client:
1. Reinicie o servidor
2. Teste pagamento de plano
3. Verifique se funciona sem erro de limite
