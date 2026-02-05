# 📊 Sistema de Planos e Cupons - Visualização Admin e Usuário

## ✅ IMPLEMENTAÇÃO COMPLETA

### 🎯 Funcionalidades Implementadas:

#### 1. **Validade de Cupons - Regra Especial**
- ✅ Cupons têm validade de **2 meses** OU até **1 mês após expiração do plano** (o que for maior)
- ✅ Validação automática na API `/api/coupons/validate`
- ✅ Cupons expiram automaticamente após 1 mês da expiração do plano

#### 2. **Sessão Admin - Informações de Planos e Cupons**
- ✅ Exibe todos os planos do usuário com:
  - Data de compra (`createdAt`)
  - Data de expiração (`endDate`)
  - Tipo de plano (`planName`, `planId`, `modo`)
  - Status (ativo/inativo)
  - Informações de assinatura recorrente (se houver)
- ✅ Exibe todos os cupons do usuário com:
  - Código do cupom
  - Status (disponível/usado/expirado)
  - Tipo de serviço (se aplicável)
  - Data de uso (se usado)
  - Data de expiração

#### 3. **Página "Minha Conta" - Visualização de Cupons**
- ✅ Cupons organizados por status:
  - **Disponíveis** (verde) - Cupons que podem ser usados
  - **Usados** (cinza) - Cupons já utilizados
  - **Expirados** (vermelho) - Cupons que expiraram
- ✅ Informações detalhadas:
  - Código do cupom
  - Tipo de serviço
  - Data de expiração
  - Aviso sobre validade até 1 mês após expiração do plano

## 📋 ESTRUTURA DE DADOS

### Plano do Usuário (`UserPlan`)
```typescript
{
  id: string;
  planId: string;           // "bronze", "prata", "ouro"
  planName: string;         // "Plano Bronze", etc.
  modo: string;             // "mensal" ou "anual"
  amount: number;           // Valor pago
  status: string;           // "active", "inactive", "expired"
  startDate: Date;          // Data de início
  endDate: Date | null;     // Data de expiração
  createdAt: Date;          // Data de compra
  subscription?: {          // Se for assinatura recorrente
    id: string;
    status: string;
    paymentMethod: string;
    billingDay: number;
    nextBillingDate: Date;
    lastBillingDate: Date | null;
  }
}
```

### Cupom (`Coupon`)
```typescript
{
  id: string;
  code: string;             // Código único do cupom
  discountType: string;     // "service", "percent", "fixed"
  serviceType: string | null; // Tipo de serviço (se for cupom de serviço)
  used: boolean;            // Se já foi usado
  usedAt: Date | null;       // Data de uso
  expiresAt: Date | null;   // Data de expiração
  createdAt: Date;          // Data de criação
  userPlanId: string | null; // ID do plano que gerou este cupom
  status: "disponivel" | "usado" | "expirado"; // Status calculado
}
```

## 🔧 LÓGICA DE VALIDAÇÃO DE CUPONS

### Regra de Expiração:
1. **Cupons têm validade de 2 meses** a partir da criação
2. **OU até 1 mês após expiração do plano** (se o plano expirar antes)
3. **Usa a data mais distante** (maior) entre as duas opções

### Exemplo:
- Plano comprado em 01/01/2024 (mensal)
- Plano expira em 01/02/2024
- Cupom criado em 01/01/2024
- **Opção 1:** 2 meses = 01/03/2024
- **Opção 2:** 1 mês após expiração = 01/03/2024
- **Resultado:** Cupom válido até 01/03/2024

### Validação na API:
```typescript
// Verificar se expirou pela data de expiração
if (coupon.expiresAt && new Date(coupon.expiresAt) < agora) {
  return { error: "Este cupom expirou" };
}

// Verificar regra especial: cupons de plano expiram 1 mês após expiração do plano
if (coupon.userPlanId && coupon.discountType === "service") {
  const userPlan = await prisma.userPlan.findUnique({
    where: { id: coupon.userPlanId },
  });

  if (userPlan && userPlan.endDate) {
    const umMesAposPlano = new Date(userPlan.endDate);
    umMesAposPlano.setMonth(umMesAposPlano.getMonth() + 1);
    
    if (agora > umMesAposPlano) {
      return { error: "Este cupom expirou. Cupons de plano são válidos até 1 mês após a expiração do plano." };
    }
  }
}
```

## 📱 INTERFACES

### Admin - Página de Usuários (`/admin/usuarios`)
- Exibe card expandido com informações de planos e cupons
- Planos mostram:
  - Status visual (verde = ativo, vermelho = inativo)
  - Informações de assinatura recorrente (se houver)
- Cupons mostram:
  - Status visual (verde = disponível, cinza = usado, vermelho = expirado)
  - Código do cupom
  - Tipo de serviço
  - Data de uso/expiração

### Usuário - Página "Minha Conta" (`/minha-conta`)
- Seção de cupons organizada por status
- Visual claro com cores diferentes:
  - **Verde** = Disponíveis
  - **Cinza** = Usados
  - **Vermelho** = Expirados
- Informações sobre validade até 1 mês após expiração do plano

## 🔄 FLUXO DE GERAÇÃO DE CUPONS

1. Usuário compra um plano
2. Webhook do Asaas confirma pagamento
3. Sistema cria `UserPlan` com status "active"
4. Sistema gera cupons de serviços baseados no plano:
   - Bronze: 2h captação, 1 mix, 1 master
   - Prata: 2h captação, 2 mix_master, 1 beat
   - Ouro: 4h captação, 2 produções completas, 2 beats
5. Cada cupom recebe `expiresAt` calculado:
   - 2 meses a partir de agora
   - OU 1 mês após expiração do plano (o que for maior)
6. Cupons ficam disponíveis na página "Minha Conta"

## ✅ TESTES RECOMENDADOS

1. **Comprar um plano** e verificar se cupons são gerados
2. **Verificar validade dos cupons** na página "Minha Conta"
3. **Usar um cupom** e verificar se aparece como "usado"
4. **Verificar expiração** após 1 mês da expiração do plano
5. **Admin:** Verificar informações de planos e cupons na página de usuários

## 📝 NOTAS IMPORTANTES

- Cupons de plano são válidos até **1 mês após expiração do plano**, mesmo que o plano expire antes dos 2 meses
- Cupons usados não podem ser reutilizados
- Cupons expirados não podem ser usados
- Admin pode ver todos os cupons de todos os usuários
- Usuário vê apenas seus próprios cupons
