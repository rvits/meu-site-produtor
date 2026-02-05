# 🚀 Guia Completo de Deploy no Vercel

## ⚠️ IMPORTANTE: Antes de Fazer Deploy

### 🔴 Problema Crítico: SQLite não funciona no Vercel

O Vercel é uma plataforma **serverless** que não permite arquivos locais persistentes. O SQLite **NÃO funciona** no Vercel porque:

- ❌ Arquivos locais são temporários e são apagados a cada deploy
- ❌ Múltiplas instâncias serverless não compartilham o mesmo arquivo
- ❌ Não há persistência de dados

**SOLUÇÃO OBRIGATÓRIA:** Migrar para **PostgreSQL** antes do deploy.

---

## 📋 Checklist Pré-Deploy

### ✅ 1. Migrar Banco de Dados para PostgreSQL

**Opções de PostgreSQL gratuitas:**
- **Vercel Postgres** (recomendado - integração nativa)
- **Supabase** (gratuito até 500MB)
- **Neon** (gratuito até 3GB)
- **Railway** (gratuito com limites)

**Passos para migração:**

1. **Criar banco PostgreSQL:**
   ```bash
   # Opção 1: Vercel Postgres (recomendado)
   # Acesse: https://vercel.com/dashboard
   # Vá em: Storage → Create Database → Postgres
   
   # Opção 2: Supabase
   # Acesse: https://supabase.com
   # Crie um projeto e copie a connection string
   ```

2. **Atualizar `prisma/schema.prisma`:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. **Configurar `DATABASE_URL` no `.env`:**
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
   ```

4. **Aplicar migrations:**
   ```bash
   npx prisma migrate dev --name init
   # ou
   npx prisma db push
   ```

5. **Migrar dados do SQLite para PostgreSQL:**
   ```bash
   # Exportar dados do SQLite
   npx prisma db pull
   
   # Importar para PostgreSQL (usar ferramenta de migração)
   ```

---

### ✅ 2. Variáveis de Ambiente Necessárias

Configure estas variáveis no **Vercel Dashboard** → **Settings** → **Environment Variables**:

#### 🔐 Obrigatórias:

```env
# Banco de Dados
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public

# Email (Gmail)
SUPPORT_EMAIL=thouse.rec.tremv@gmail.com
SUPPORT_EMAIL_PASSWORD=kjpexhpoqeqxycza
SUPPORT_DEST_EMAIL=thouse.rec.tremv@gmail.com

# Asaas (Pagamentos)
ASAAS_API_KEY=$aact_YTU5YTE0M2M2N2I4MTIxNzliZDkxYWE5Y2I2NDRjMDM6OjAwMDAwMDAwMDAwMDAwNzU3NDY6OiRhYWNoXzE4YzM0NDNhLWE3YjEtNDY5ZC05YjM5LWM5ZDFhNzI4YjFjYw==

# OpenAI (Chat)
OPENAI_API_KEY=sk-proj-...

# Ambiente
NODE_ENV=production
```

#### 📝 Opcionais (se usar outros provedores):

```env
# Infinity Pay (alternativa)
INFINITYPAY_API_KEY=sua_api_key

# Mercado Pago (alternativa)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
```

---

### ✅ 3. Configurar Build Settings no Vercel

No Vercel Dashboard, configure:

**Build Command:**
```bash
prisma generate && next build
```

**Output Directory:**
```
.next
```

**Install Command:**
```bash
npm install
```

**Node Version:**
```
20.x (ou a versão que você está usando)
```

---

### ✅ 4. Atualizar Webhooks do Asaas

Após o deploy, atualize os webhooks do Asaas para apontar para a URL do Vercel:

1. Acesse o painel do Asaas
2. Vá em **Integrações** → **Webhooks**
3. Configure a URL:
   ```
   https://seu-dominio.vercel.app/api/webhooks/asaas
   ```
4. Salve as configurações

---

### ✅ 5. Criar Arquivo `.vercelignore` (Opcional)

Crie um arquivo `.vercelignore` na raiz do projeto:

```
.env
.env.local
.env.*.local
dev.db
*.log
node_modules/.cache
```

---

## 🚀 Passo a Passo do Deploy

### Opção 1: Deploy via GitHub (Recomendado)

1. **Fazer commit e push do código:**
   ```bash
   git add .
   git commit -m "Preparar para deploy no Vercel"
   git push origin main
   ```

2. **Conectar repositório no Vercel:**
   - Acesse: https://vercel.com/new
   - Clique em "Import Git Repository"
   - Selecione seu repositório
   - Configure as variáveis de ambiente
   - Clique em "Deploy"

3. **Aguardar build:**
   - O Vercel vai instalar dependências
   - Executar `prisma generate`
   - Fazer build do Next.js
   - Deploy automático

### Opção 2: Deploy via CLI

1. **Instalar Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Fazer login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Deploy de produção:**
   ```bash
   vercel --prod
   ```

---

## 🔧 Configurações Adicionais

### 1. Criar `vercel.json` (Opcional)

Crie um arquivo `vercel.json` na raiz:

```json
{
  "buildCommand": "prisma generate && next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["gru1"],
  "env": {
    "PRISMA_GENERATE_DATAPROXY": "true"
  }
}
```

### 2. Configurar Domínio Personalizado

1. No Vercel Dashboard → **Settings** → **Domains**
2. Adicione seu domínio
3. Configure os registros DNS conforme instruções

### 3. Configurar Cron Jobs (se necessário)

Se você tem cron jobs (limpeza de chats, renovação de planos), use:

- **Vercel Cron** (recomendado)
- **GitHub Actions**
- **Serviços externos** (cron-job.org, etc.)

Exemplo de `vercel.json` com cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/limpar-chats-antigos",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/renovar-planos",
      "schedule": "0 0 * * *"
    }
  ]
}
```

---

## ⚠️ Problemas Comuns e Soluções

### ❌ Erro: "Prisma Client not generated"

**Solução:**
- Adicione `prisma generate` no build command
- Ou adicione `"postinstall": "prisma generate"` no `package.json`

### ❌ Erro: "Database connection failed"

**Solução:**
- Verifique se `DATABASE_URL` está configurada corretamente
- Verifique se o banco PostgreSQL está acessível
- Adicione o IP do Vercel nas configurações de firewall do banco

### ❌ Erro: "Environment variable not found"

**Solução:**
- Verifique se todas as variáveis estão configuradas no Vercel Dashboard
- Certifique-se de que estão marcadas para "Production", "Preview" e "Development"

### ❌ Erro: "Build timeout"

**Solução:**
- Otimize o build removendo dependências desnecessárias
- Use `prisma generate` apenas quando necessário
- Considere usar Prisma Data Proxy para builds mais rápidos

---

## 📊 Monitoramento Pós-Deploy

### 1. Verificar Logs

- Acesse: Vercel Dashboard → **Deployments** → Seu deploy → **Logs**
- Monitore erros e warnings

### 2. Testar Funcionalidades

- ✅ Login/Registro
- ✅ Agendamentos
- ✅ Pagamentos
- ✅ Chat
- ✅ FAQ
- ✅ Notificações

### 3. Configurar Alertas

- Configure alertas no Vercel para erros críticos
- Monitore performance e uptime

---

## 🎯 Resumo Rápido

### ✅ O que fazer ANTES do deploy:

1. ⚠️ **MIGRAR SQLite → PostgreSQL** (OBRIGATÓRIO)
2. ✅ Configurar todas as variáveis de ambiente
3. ✅ Atualizar webhooks do Asaas
4. ✅ Testar build local: `npm run build`
5. ✅ Fazer commit e push do código

### ✅ O que fazer DEPOIS do deploy:

1. ✅ Testar todas as funcionalidades
2. ✅ Atualizar webhooks do Asaas com URL do Vercel
3. ✅ Configurar domínio personalizado (se necessário)
4. ✅ Configurar cron jobs (se necessário)
5. ✅ Monitorar logs e performance

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas durante o deploy:

1. Verifique os logs no Vercel Dashboard
2. Teste o build local: `npm run build`
3. Verifique se todas as variáveis de ambiente estão configuradas
4. Certifique-se de que o banco PostgreSQL está acessível

---

**Boa sorte com o deploy! 🚀**
