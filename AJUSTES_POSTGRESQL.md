# 🔧 Ajustes Necessários para PostgreSQL

## ⚠️ Queries SQL que Precisam ser Ajustadas

Algumas queries usam sintaxe específica do SQLite que precisa ser adaptada para PostgreSQL.

---

## 📋 Queries que Precisam Ajuste:

### 1. **`src/app/api/chat/sessions/route.ts`**

**Problema:** Usa `datetime()` que é específico do SQLite

**SQLite (atual):**
```sql
SELECT COUNT(*) as count
FROM ChatMessage
WHERE chatSessionId = ?
  AND senderType IN ('admin', 'human')
  AND datetime(createdAt) > datetime(?)
```

**PostgreSQL (correto):**
```sql
SELECT COUNT(*) as count
FROM "ChatMessage"
WHERE "chatSessionId" = $1
  AND "senderType" IN ('admin', 'human')
  AND "createdAt" > $2::timestamp
```

**OU usar Prisma (recomendado):**
```typescript
const unreadCount = await prisma.chatMessage.count({
  where: {
    chatSessionId: session.id,
    senderType: { in: ['admin', 'human'] },
    createdAt: { gt: lastReadDate }
  }
});
```

---

### 2. **`src/app/api/chat/messages/route.ts`**

**Problema:** Usa `?` placeholders e `datetime()`

**Ajuste necessário:** Usar `$1, $2` ou melhor ainda, usar Prisma Client

---

### 3. **`src/app/api/meus-dados/route.ts`**

**Problema:** Queries raw com `?` placeholders

**Ajuste necessário:** Usar `$1, $2` ou Prisma Client

---

### 4. **`src/app/api/plans/mark-read/route.ts`**
### 5. **`src/app/api/appointments/mark-read/route.ts`**
### 6. **`src/app/api/chat/mark-read/route.ts`**

**Problema:** `ALTER TABLE ... ADD COLUMN` pode ter sintaxe diferente

**PostgreSQL:**
```sql
ALTER TABLE "UserPlan" ADD COLUMN "readAt" TIMESTAMP;
```

---

## ✅ Solução Recomendada:

**Opção 1: Usar Prisma Client (Melhor)**
- Substituir queries raw por Prisma Client
- Mais seguro e portável
- Funciona em qualquer banco

**Opção 2: Ajustar Queries Raw**
- Trocar `?` por `$1, $2, $3...`
- Trocar `datetime()` por `::timestamp` ou `CAST(... AS TIMESTAMP)`
- Adicionar aspas duplas em nomes de tabelas/colunas

---

## 🔄 Próximo Passo:

Após configurar o PostgreSQL e testar, vamos ajustar essas queries para garantir compatibilidade total.

---

**Nota:** O Prisma Client já lida com essas diferenças automaticamente, então o ideal é usar Prisma Client sempre que possível.
