# 🚀 Guia Rápido de Deploy no Vercel

## ✅ Status Atual

- ✅ Migração para PostgreSQL concluída
- ✅ Queries adaptadas para PostgreSQL
- ✅ Código corrigido e sem erros
- ✅ Build configurado corretamente

## 📋 Checklist Antes do Deploy

### 1. Banco de Dados PostgreSQL

Você precisa de um banco PostgreSQL em produção. Opções gratuitas:

**Opção 1: Vercel Postgres (Recomendado - Integração Nativa)**
1. Acesse: https://vercel.com/dashboard
2. Vá em: **Storage** → **Create Database** → **Postgres**
3. Copie a connection string gerada

**Opção 2: Supabase (Gratuito até 500MB)**
1. Acesse: https://supabase.com
2. Crie um projeto
3. Vá em **Settings** → **Database**
4. Copie a connection string (URI)

**Opção 3: Neon (Gratuito até 3GB)**
1. Acesse: https://neon.tech
2. Crie um projeto
3. Copie a connection string

### 2. Variáveis de Ambiente no Vercel

No Vercel Dashboard → **Settings** → **Environment Variables**, adicione:

```env
# Banco de Dados (OBRIGATÓRIO)
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# Email (OBRIGATÓRIO)
SUPPORT_EMAIL=thouse.rec.tremv@gmail.com
SUPPORT_EMAIL_PASSWORD=kjpexhpoqeqxycza
SUPPORT_DEST_EMAIL=thouse.rec.tremv@gmail.com

# Asaas - Pagamentos (OBRIGATÓRIO)
ASAAS_API_KEY=$aact_YTU5YTE0M2M2N2I4MTIxNzliZDkxYWE5Y2I2NDRjMDM6OjAwMDAwMDAwMDAwMDAwNzU3NDY6OiRhYWNoXzE4YzM0NDNhLWE3YjEtNDY5ZC05YjM5LWM5ZDFhNzI4YjFjYw==

# OpenAI - Chat (OBRIGATÓRIO)
OPENAI_API_KEY=sk-proj-...

# Ambiente
NODE_ENV=production
```

**⚠️ IMPORTANTE:**
- Configure essas variáveis para **Production**, **Preview** e **Development**
- A `DATABASE_URL` deve ser a do seu banco PostgreSQL em produção
- Não use a `DATABASE_URL` local do seu computador

### 3. Aplicar Schema no Banco de Produção

Após criar o banco PostgreSQL, você precisa aplicar o schema:

**Opção 1: Via Vercel (Recomendado)**
1. No Vercel Dashboard, vá em **Storage** → Seu banco Postgres
2. Clique em **.env.local** e copie a `DATABASE_URL`
3. Configure no Vercel como variável de ambiente
4. O Vercel executará `prisma generate` automaticamente no build

**Opção 2: Manual (Local)**
```bash
# Configure a DATABASE_URL do banco de produção temporariamente
export DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# Aplique o schema
npx prisma db push

# OU crie uma migration
npx prisma migrate deploy
```

### 4. Migrar Dados (Se Necessário)

Se você já tem dados no banco local que quer migrar:

```bash
# Execute o script de migração apontando para o banco de produção
# (CUIDADO: Isso vai sobrescrever dados no banco de produção!)
DATABASE_URL="postgresql://..." npm run migrate:postgresql
```

**⚠️ ATENÇÃO:** Só faça isso se quiser migrar dados do SQLite local para produção.

## 🚀 Passo a Passo do Deploy

### 1. Preparar o Código

```bash
# Certifique-se de que tudo está commitado
git status

# Se houver mudanças, faça commit
git add .
git commit -m "Preparar para deploy no Vercel"
git push origin main
```

### 2. Conectar ao Vercel

**Opção 1: Via GitHub (Recomendado)**
1. Acesse: https://vercel.com
2. Clique em **Add New Project**
3. Conecte seu repositório GitHub
4. Selecione o repositório do projeto

**Opção 2: Via CLI**
```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer login
vercel login

# Deploy
vercel
```

### 3. Configurar o Projeto no Vercel

Quando conectar o repositório, o Vercel detectará automaticamente:
- **Framework Preset:** Next.js
- **Build Command:** `prisma generate && next build` (já configurado no package.json)
- **Output Directory:** `.next` (automático)

**Você só precisa:**
1. Adicionar as variáveis de ambiente (veja seção 2 acima)
2. Configurar a `DATABASE_URL` do banco PostgreSQL de produção

### 4. Fazer o Deploy

1. Clique em **Deploy**
2. Aguarde o build completar
3. Verifique os logs se houver erros

### 5. Aplicar Schema no Banco de Produção

Após o primeiro deploy, você precisa aplicar o schema:

**Via Vercel CLI:**
```bash
# Configurar DATABASE_URL temporariamente
vercel env pull .env.local

# Aplicar schema
npx prisma db push --accept-data-loss
```

**OU via Prisma Studio (se tiver acesso ao banco):**
```bash
# Abrir Prisma Studio apontando para produção
DATABASE_URL="postgresql://..." npx prisma studio
```

### 6. Atualizar Webhooks do Asaas

Após o deploy, atualize os webhooks:

1. Acesse o painel do Asaas
2. Vá em **Integrações** → **Webhooks**
3. Configure a URL:
   ```
   https://seu-dominio.vercel.app/api/webhooks/asaas
   ```
4. Salve

## 🔍 Verificações Pós-Deploy

### 1. Verificar Build
- ✅ Build completou sem erros
- ✅ Prisma Client foi gerado corretamente

### 2. Verificar Banco de Dados
- ✅ Conexão com PostgreSQL funcionando
- ✅ Schema aplicado corretamente
- ✅ Tabelas criadas

### 3. Testar Funcionalidades
- ✅ Login/Registro funcionando
- ✅ Chat funcionando
- ✅ FAQ funcionando
- ✅ Pagamentos funcionando
- ✅ Agendamentos funcionando

## 🐛 Troubleshooting

### Erro: "Prisma Client not generated"
**Solução:** O build command já inclui `prisma generate`, mas se persistir:
1. Vá em **Settings** → **Build & Development Settings**
2. Adicione no **Build Command:** `prisma generate && next build`

### Erro: "Database connection failed"
**Solução:**
1. Verifique se a `DATABASE_URL` está correta
2. Verifique se o banco permite conexões externas
3. Verifique se o IP do Vercel está na whitelist (se necessário)

### Erro: "Table does not exist"
**Solução:**
1. Execute `npx prisma db push` apontando para o banco de produção
2. Ou crie uma migration: `npx prisma migrate deploy`

## 📝 Notas Importantes

1. **Backup:** Sempre faça backup antes de fazer mudanças no banco de produção
2. **Variáveis de Ambiente:** Nunca commite variáveis de ambiente no Git
3. **Migrations:** Use `prisma migrate deploy` em produção (não `migrate dev`)
4. **Logs:** Use o Vercel Dashboard para ver logs em tempo real

## ✅ Pronto para Deploy!

Se você seguiu todos os passos acima, está pronto para fazer o deploy! 🚀

---

**Última atualização:** Janeiro 2025
