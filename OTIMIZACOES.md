# 🚀 Otimizações e Melhorias Recomendadas

Este documento lista todas as otimizações, correções e melhorias recomendadas para o projeto THouse Rec, organizadas por prioridade e categoria.

## 🔴 CRÍTICO - Corrigir Imediatamente

### 1. **Bug na Integração OpenAI** ⚠️
**Arquivo:** `src/app/lib/ai.ts`

**Problema:** A API da OpenAI está sendo chamada incorretamente. O método `openai.responses.create()` não existe na SDK atual.

**Solução:**
```typescript
// ❌ ERRADO (linha 19)
const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  // ...
});

// ✅ CORRETO
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini", // ou "gpt-3.5-turbo"
  messages: [
    {
      role: "system",
      content: `Você é o suporte oficial da THouse Rec...`
    },
    ...messages,
  ],
});

return response.choices[0]?.message?.content ?? null;
```

### 2. **Bug no Agendamento - Conversão de Tipo Incorreta**
**Arquivo:** `src/app/api/agendamentos/route.ts` (linha 59)

**Problema:** `userId` é `String` no schema, mas está sendo convertido para `Number`.

**Solução:**
```typescript
// ❌ ERRADO
where = {
  userId: Number(userId), // userId é String!
};

// ✅ CORRETO
where = {
  userId: userId,
};
```

### 3. **Webhook do Mercado Pago Incompleto**
**Arquivo:** `src/app/api/webhooks/mercadopago/route.ts`

**Problema:** O webhook não valida a assinatura do Mercado Pago e não processa os pagamentos.

**Solução:** Implementar validação de assinatura e processamento completo dos pagamentos.

---

## 🟠 ALTA PRIORIDADE - Segurança

### 4. **Middleware de Autenticação**
**Problema:** Cada rota valida autenticação manualmente, causando duplicação de código.

**Solução:** Criar middleware reutilizável:

```typescript
// src/app/lib/auth.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  
  if (!sessionId) return null;
  
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  
  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  
  return session.user;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Não autenticado");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new Error("Acesso negado");
  }
  return user;
}
```

**Uso nas rotas:**
```typescript
export async function GET() {
  const user = await requireAuth();
  // user está garantido aqui
}
```

### 5. **Validação de Dados de Entrada**
**Problema:** Falta validação consistente nos endpoints.

**Solução:** Usar biblioteca de validação como `zod`:

```bash
npm install zod
```

```typescript
// src/app/lib/validations.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const agendamentoSchema = z.object({
  userId: z.string().uuid(),
  data: z.string().datetime(),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  duracaoMinutos: z.number().int().min(30).max(480),
  tipo: z.string().min(1),
  observacoes: z.string().optional(),
});
```

### 6. **Email Hardcoded**
**Arquivo:** `src/app/lib/sendEmail.ts` (linha 31)

**Problema:** Email de destino está hardcoded.

**Solução:** Mover para variável de ambiente:
```typescript
const DEST_EMAIL = process.env.SUPPORT_DEST_EMAIL || "tremv03021@gmail.com";
```

### 7. **Verificação de Admin Hardcoded**
**Arquivo:** `src/app/components/Header.tsx` (linha 29-30)

**Problema:** Email específico hardcoded para verificação de admin.

**Solução:** Usar apenas `role === "ADMIN"` ou criar tabela de configuração.

### 8. **Rate Limiting**
**Problema:** Não há proteção contra abuso de APIs.

**Solução:** Implementar rate limiting:
```bash
npm install @upstash/ratelimit @upstash/redis
```

Ou usar middleware simples com cache em memória para desenvolvimento.

### 9. **Validação de Sessões Expiradas**
**Problema:** Sessões expiradas não são limpas automaticamente.

**Solução:** Criar job/cron para limpar sessões expiradas ou fazer limpeza no login:

```typescript
// Limpar sessões expiradas ao fazer login
await prisma.session.deleteMany({
  where: {
    expiresAt: { lt: new Date() },
  },
});
```

---

## 🟡 MÉDIA PRIORIDADE - Performance

### 10. **Índices no Banco de Dados**
**Problema:** Falta índices em campos frequentemente consultados.

**Solução:** Adicionar índices no schema:

```prisma
model Appointment {
  // ...
  @@index([userId])
  @@index([data])
  @@index([status])
}

model FAQ {
  // ...
  @@index([question]) // Para busca full-text
  @@index([createdAt])
}

model Session {
  // ...
  @@index([expiresAt]) // Para limpeza eficiente
}
```

### 11. **Busca Full-Text no FAQ**
**Arquivo:** `src/app/api/faq/search/route.ts`

**Problema:** Busca usando `contains` é lenta e não diferencia maiúsculas/minúsculas.

**Solução:** 
- Para SQLite: Usar FTS (Full-Text Search) ou migrar para PostgreSQL
- Para PostgreSQL: Usar `pg_trgm` ou `tsvector`

```typescript
// Com PostgreSQL
const faqs = await prisma.$queryRaw`
  SELECT * FROM "FAQ"
  WHERE to_tsvector('portuguese', question || ' ' || answer) 
  @@ plainto_tsquery('portuguese', ${q})
  ORDER BY createdAt DESC
  LIMIT 30
`;
```

### 12. **Paginação nas Queries**
**Problema:** Queries sem limite podem retornar muitos dados.

**Solução:** Implementar paginação consistente:

```typescript
const page = parseInt(searchParams.get("page") || "1");
const limit = parseInt(searchParams.get("limit") || "20");
const skip = (page - 1) * limit;

const [faqs, total] = await Promise.all([
  prisma.fAQ.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
  }),
  prisma.fAQ.count(),
]);

return NextResponse.json({
  faqs,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});
```

### 13. **Validação de Conflitos de Agendamento**
**Arquivo:** `src/app/api/agendamentos/route.ts`

**Problema:** Não verifica se já existe agendamento no mesmo horário.

**Solução:**
```typescript
const dataInicio = new Date(`${data}T${hora}:00`);
const dataFim = new Date(dataInicio.getTime() + duracaoMinutos * 60000);

// Verificar conflitos
const conflito = await prisma.appointment.findFirst({
  where: {
    status: { not: "cancelado" },
    OR: [
      {
        AND: [
          { data: { lte: dataInicio } },
          { 
            data: { 
              gte: new Date(dataInicio.getTime() - duracaoMinutos * 60000)
            }
          },
        ],
      },
      {
        AND: [
          { data: { gte: dataInicio } },
          { data: { lte: dataFim } },
        ],
      },
    ],
  },
});

if (conflito) {
  return NextResponse.json(
    { error: "Horário já está agendado." },
    { status: 409 }
  );
}
```

### 14. **Cache para Dados Estáticos**
**Problema:** Dados como planos são buscados do banco toda vez.

**Solução:** Usar cache (Redis ou Next.js cache):

```typescript
import { unstable_cache } from "next/cache";

export const getPlanos = unstable_cache(
  async () => {
    // Buscar do banco
    return PLANOS;
  },
  ["planos"],
  { revalidate: 3600 } // 1 hora
);
```

### 15. **Otimização de Queries com Includes**
**Problema:** Queries podem ter N+1 problems.

**Solução:** Sempre usar `include` quando necessário:

```typescript
const agendamentos = await prisma.appointment.findMany({
  include: {
    user: {
      select: {
        id: true,
        nomeArtistico: true,
        email: true,
      },
    },
  },
});
```

---

## 🟢 BAIXA PRIORIDADE - Qualidade de Código

### 16. **Eliminar Tipos `any`**
**Problema:** Uso de `any` em vários lugares reduz type safety.

**Arquivos afetados:**
- `src/app/api/agendamentos/route.ts` (linha 49)
- `src/app/api/chat/route.ts` (linha 76)
- `src/app/api/mercadopago/checkout/route.ts` (linhas 114-115)

**Solução:** Criar tipos específicos:

```typescript
// src/app/types/mercadopago.ts
export interface MercadoPagoPreferenceResponse {
  init_point?: string;
  sandbox_init_point?: string;
  id: string;
  // ... outros campos
}
```

### 17. **Tratamento de Erros Consistente**
**Problema:** Erros são tratados de forma inconsistente.

**Solução:** Criar classe de erro customizada:

```typescript
// src/app/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Uso
if (!user) {
  throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
}
```

### 18. **Validação de Environment Variables**
**Problema:** Variáveis de ambiente não são validadas na inicialização.

**Solução:** Criar arquivo de validação:

```typescript
// src/app/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  // ...
});

export const env = envSchema.parse(process.env);
```

### 19. **Logging Estruturado**
**Problema:** `console.log` e `console.error` não são ideais para produção.

**Solução:** Usar biblioteca de logging:

```bash
npm install pino
```

### 20. **Testes**
**Problema:** Não há testes no projeto.

**Solução:** Adicionar testes:
- Unit tests para funções utilitárias
- Integration tests para APIs
- E2E tests para fluxos críticos

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

---

## 🔵 ARQUITETURA - Melhorias Estruturais

### 21. **Migrar para PostgreSQL em Produção**
**Problema:** SQLite não é adequado para produção.

**Solução:** 
- Configurar PostgreSQL no ambiente de produção
- Atualizar `DATABASE_URL`
- Executar migrações

### 22. **Separar Lógica de Negócio**
**Problema:** Lógica de negócio está misturada com rotas.

**Solução:** Criar camada de serviços:

```
src/app/
  services/
    auth.service.ts
    agendamento.service.ts
    pagamento.service.ts
    faq.service.ts
```

### 23. **Configuração Centralizada**
**Problema:** Configurações espalhadas pelo código.

**Solução:** Criar arquivo de configuração:

```typescript
// src/app/config/index.ts
export const config = {
  app: {
    name: "THouse Rec",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 dias
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  // ...
};
```

### 24. **Type Safety nas Rotas**
**Problema:** Tipos de request/response não são consistentes.

**Solução:** Criar tipos compartilhados:

```typescript
// src/app/types/api.ts
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### 25. **Documentação de API**
**Problema:** APIs não estão documentadas.

**Solução:** Usar OpenAPI/Swagger ou criar documentação manual em Markdown.

---

## 📊 Resumo de Prioridades

### 🔴 Fazer Agora (Esta Semana)
1. Corrigir bug OpenAI
2. Corrigir conversão de userId
3. Implementar middleware de autenticação
4. Adicionar validação de dados

### 🟠 Fazer em Breve (Este Mês)
5. Implementar webhook completo do Mercado Pago
6. Adicionar rate limiting
7. Implementar validação de conflitos de agendamento
8. Adicionar índices no banco de dados

### 🟡 Planejar (Próximos Meses)
9. Migrar para PostgreSQL
10. Implementar testes
11. Adicionar cache
12. Melhorar busca de FAQ

### 🟢 Melhorias Contínuas
13. Eliminar tipos `any`
14. Melhorar tratamento de erros
15. Adicionar logging estruturado
16. Refatorar para camada de serviços

---

## 📝 Notas Finais

- **Priorize segurança**: Corrija bugs críticos e implemente autenticação adequada primeiro
- **Teste em ambiente de desenvolvimento**: Sempre teste mudanças antes de produção
- **Documente mudanças**: Mantenha o README e este arquivo atualizados
- **Versionamento**: Use commits semânticos e tags para releases

---

**Última atualização:** Dezembro 2024
