# 🎟️ Sistema de Cupons - Plano vs Reembolso

## ✅ IMPLEMENTAÇÃO COMPLETA

### 🎯 Diferenças Entre Tipos de Cupons:

#### 1. **Cupons de Plano** (`couponType: "plano"`)
- ✅ Gerados automaticamente quando usuário compra um plano
- ✅ Permitem usar serviços específicos **gratuitamente** (zeram o valor total)
- ✅ Cada serviço deve ser agendado separadamente
- ✅ Válidos até 1 mês após expiração do plano OU 2 meses (o que for maior)
- ✅ Tipo: `discountType: "service"` (não tem valor monetário)

#### 2. **Cupons de Reembolso** (`couponType: "reembolso"`)
- ✅ Gerados quando agendamento é cancelado ou recusado
- ✅ Servem como **crédito** para descontar do valor total
- ✅ Podem **zerar** o serviço se valor do cupom >= valor do serviço
- ✅ Podem ser usados como **desconto parcial** se valor do cupom < valor do serviço
- ✅ **IMPORTANTE:** Sobras não utilizadas **se perdem** - não acumulam crédito
- ✅ Não existe valor negativo (se serviço for mais barato, sobra se perde)
- ✅ Tipo: `discountType: "fixed"` (tem valor monetário)

## 📋 REGRAS DE VALIDAÇÃO:

### Cupons de Reembolso:
```typescript
if (isRefundCoupon) {
  if (coupon.discountValue >= total) {
    // Zerar o total
    discount = total;
    finalTotal = 0;
  } else {
    // Desconto parcial: usuário paga a diferença
    discount = coupon.discountValue;
    finalTotal = total - discount;
  }
  // IMPORTANTE: Sobras não acumulam - se sobrar, se perde
}
```

### Cupons de Plano:
```typescript
if (coupon.discountType === "service") {
  // Zera o valor do serviço específico
  discount = total;
  finalTotal = 0;
}
```

## 🔧 MUDANÇAS IMPLEMENTADAS:

### 1. **Schema Prisma**
- ✅ Adicionado campo `couponType` ao modelo `Coupon`
- ✅ Valores: `"plano"` ou `"reembolso"`

### 2. **API de Validação** (`/api/coupons/validate`)
- ✅ Distingue entre cupons de plano e reembolso
- ✅ Cupons de reembolso podem zerar ou dar desconto parcial
- ✅ Sobras não acumulam (se sobrar, se perde)

### 3. **Criação de Cupons**
- ✅ Cupons de plano: `couponType: "plano"` (em `plan-coupons.ts`)
- ✅ Cupons de reembolso: `couponType: "reembolso"` (em cancelar/recusar agendamento)

### 4. **Página de Agendamento** (`/agendamento`)
- ✅ Campo para inserir código do cupom
- ✅ Validação em tempo real
- ✅ Mostra desconto aplicado (em vermelho/negativo)
- ✅ Mostra total com desconto
- ✅ Indica tipo de cupom aplicado (plano ou reembolso)

### 5. **Página "Minha Conta"** (`/minha-conta`)
- ✅ Separação visual entre cupons de plano e reembolso
- ✅ Explicação clara sobre cada tipo
- ✅ Cupons de plano: verde
- ✅ Cupons de reembolso: azul
- ✅ Aviso sobre sobras não acumularem

### 6. **Página Admin** (`/admin/usuarios`)
- ✅ Mostra tipo de cupom (plano/reembolso)
- ✅ Cores diferentes para cada tipo
- ✅ Informações sobre valor (para cupons de reembolso)

### 7. **API de Checkout** (`/api/asaas/checkout-agendamento`)
- ✅ Aceita `cupomCode` no body
- ✅ Valida cupom antes de criar checkout
- ✅ Aplica desconto ao valor total
- ✅ Passa código do cupom no metadata para webhook

## 🎨 INTERFACE:

### Página de Agendamento:
```
Total estimado: R$ 150,00
Cupom ABC123: -R$ 50,00  (em verde)
Total com desconto: R$ 100,00
```

### Página "Minha Conta":
```
ℹ️ Tipos de Cupons
🟢 Cupons de Plano: Zeram serviços específicos
🔵 Cupons de Reembolso: Crédito que pode zerar ou dar desconto parcial

✅ Cupons de Plano - Disponíveis (2)
[Card verde com código e serviço]

💰 Cupons de Reembolso - Disponíveis (1)
[Card azul com código e valor]
⚠️ Pode zerar o serviço ou ser usado como desconto parcial. Sobras não utilizadas se perdem.
```

## ✅ FLUXO COMPLETO:

### Usuário aplica cupom de reembolso:
1. Usuário seleciona serviços (ex: R$ 150,00)
2. Usuário insere código do cupom (ex: R$ 50,00)
3. Sistema valida cupom
4. Sistema calcula desconto: R$ 50,00
5. Sistema mostra: Total com desconto: R$ 100,00
6. Usuário confirma e vai para pagamento
7. Sistema cria checkout com valor de R$ 100,00 (não R$ 150,00)
8. Usuário paga R$ 100,00 no Asaas
9. Cupom é marcado como usado
10. **Sobra de R$ 0,00** (não acumula)

### Usuário aplica cupom de reembolso maior que o total:
1. Usuário seleciona serviços (ex: R$ 50,00)
2. Usuário insere código do cupom (ex: R$ 100,00)
3. Sistema valida cupom
4. Sistema calcula desconto: R$ 50,00 (apenas o total)
5. Sistema mostra: Total com desconto: R$ 0,00
6. Usuário confirma e vai para pagamento
7. Sistema cria checkout com valor de R$ 0,00
8. Agendamento é criado sem pagamento
9. Cupom é marcado como usado
10. **Sobra de R$ 50,00 se perde** (não acumula)

## 📝 NOTAS IMPORTANTES:

1. **Sobras não acumulam**: Se um cupom de reembolso for maior que o total, a sobra se perde
2. **Não existe valor negativo**: Se serviço for mais barato, sobra se perde
3. **Cupons de plano**: Sempre zeram o serviço específico
4. **Cupons de reembolso**: Podem zerar ou dar desconto parcial
5. **Visualização**: Desconto aparece em verde/azul na página de agendamento
6. **Separação**: Cupons são separados por tipo na página "Minha Conta"

## ✅ TESTES RECOMENDADOS:

1. **Cupom de reembolso menor que total:**
   - Serviço: R$ 150,00
   - Cupom: R$ 50,00
   - Resultado: Total R$ 100,00 (usuário paga diferença)

2. **Cupom de reembolso maior que total:**
   - Serviço: R$ 50,00
   - Cupom: R$ 100,00
   - Resultado: Total R$ 0,00 (sobra se perde)

3. **Cupom de plano:**
   - Serviço: R$ 150,00
   - Cupom: serviço específico
   - Resultado: Total R$ 0,00 (zera completamente)

4. **Verificar separação na "Minha Conta":**
   - Cupons de plano aparecem em verde
   - Cupons de reembolso aparecem em azul
   - Explicação sobre diferenças visível
