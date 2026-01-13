# 🐘 Guia de Migração para PostgreSQL

Este guia explica como migrar o banco de dados de SQLite para PostgreSQL em produção.

## 📋 Pré-requisitos

1. Banco PostgreSQL configurado (local ou em serviço como Railway, Supabase, etc.)
2. String de conexão PostgreSQL
3. Backup do banco SQLite atual (se houver dados importantes)

## 🔄 Passos para Migração

### 1. Instalar Driver PostgreSQL

```bash
npm install pg @types/pg
```

### 2. Atualizar Schema Prisma

O arquivo `prisma/schema.postgresql.prisma` já está preparado. Para usar:

```bash
# Fazer backup do schema atual
cp prisma/schema.prisma prisma/schema.sqlite.backup.prisma

# Substituir pelo schema PostgreSQL
cp prisma/schema.postgresql.prisma prisma/schema.prisma
```

Ou edite manualmente `prisma/schema.prisma` e altere:

```prisma
datasource db {
  provider = "postgresql"  // Era "sqlite"
  url      = env("DATABASE_URL")
}
```

### 3. Configurar DATABASE_URL

No arquivo `.env` ou nas variáveis de ambiente:

```env
# Formato da URL PostgreSQL:
# postgresql://usuario:senha@host:porta/database?schema=public

DATABASE_URL="postgresql://user:password@localhost:5432/thouse_rec?schema=public"
```

### 4. Gerar Cliente Prisma

```bash
npx prisma generate
```

### 5. Criar Banco de Dados

```bash
# Criar banco (se não existir)
createdb thouse_rec

# Ou via psql:
psql -U postgres
CREATE DATABASE thouse_rec;
```

### 6. Executar Migrações

```bash
# Criar migração inicial (se necessário)
npx prisma migrate dev --name init_postgresql

# Ou aplicar migrações existentes
npx prisma migrate deploy
```

### 7. Migrar Dados (se houver)

Se você tem dados no SQLite que precisam ser migrados:

```bash
# Opção 1: Usar ferramenta de migração
npm install -g prisma-db-pull

# Opção 2: Exportar/Importar manualmente
# Exportar do SQLite
sqlite3 prisma/dev.db .dump > backup.sql

# Adaptar e importar no PostgreSQL
psql -U postgres -d thouse_rec < backup.sql
```

### 8. Verificar

```bash
# Abrir Prisma Studio
npx prisma studio

# Verificar conexão
npx prisma db pull
```

## 🔍 Diferenças SQLite vs PostgreSQL

### Vantagens do PostgreSQL

- ✅ Melhor performance em produção
- ✅ Suporte a transações ACID completas
- ✅ Full-text search nativo
- ✅ Melhor escalabilidade
- ✅ Suporte a JSON nativo
- ✅ Triggers e stored procedures

### Mudanças Necessárias no Código

1. **Queries Raw SQL**: Algumas queries podem precisar de ajustes
2. **Tipos de Dados**: PostgreSQL tem tipos mais específicos
3. **Full-Text Search**: Pode usar `pg_trgm` para busca melhorada

## 📝 Exemplo de Busca Full-Text no PostgreSQL

No arquivo `src/app/api/faq/search/route.ts`, você pode usar:

```typescript
// Para PostgreSQL com pg_trgm
const faqs = await prisma.$queryRaw`
  SELECT * FROM "FAQ"
  WHERE similarity(question, ${q}) > 0.3
     OR similarity(answer, ${q}) > 0.3
  ORDER BY similarity(question, ${q}) DESC
  LIMIT ${limit}
`;
```

## 🚀 Deploy em Produção

### Vercel + Supabase

1. Criar projeto no [Supabase](https://supabase.com)
2. Copiar connection string
3. Adicionar como `DATABASE_URL` no Vercel
4. Executar `prisma migrate deploy` no build

### Railway

1. Criar projeto PostgreSQL no Railway
2. Copiar connection string
3. Adicionar como `DATABASE_URL`
4. Railway executa migrações automaticamente

## ⚠️ Notas Importantes

- **Backup**: Sempre faça backup antes de migrar
- **Teste**: Teste em ambiente de staging primeiro
- **Downtime**: Planeje um período de manutenção
- **Rollback**: Tenha um plano de rollback

## 🔄 Rollback

Se precisar voltar para SQLite:

```bash
# Restaurar schema
cp prisma/schema.sqlite.backup.prisma prisma/schema.prisma

# Regenerar cliente
npx prisma generate

# Recriar banco
rm prisma/dev.db
npx prisma migrate dev
```

---

**Última atualização:** Dezembro 2024
