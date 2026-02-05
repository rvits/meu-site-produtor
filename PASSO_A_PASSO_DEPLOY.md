# 🚀 Guia Passo a Passo - Deploy no Vercel

## ✅ PASSO 1: Commit e Push (JÁ FEITO)
- ✅ Arquivos commitados
- ⏳ Próximo: Fazer push para GitHub

**Execute agora:**
```bash
git push origin main
```

---

## 📋 PASSO 2: Criar Banco PostgreSQL em Produção

### Opção 1: Vercel Postgres (RECOMENDADO - Mais Fácil)

1. **Acesse:** https://vercel.com/dashboard
2. **Faça login** (ou crie conta se necessário)
3. **Vá em:** Storage (menu lateral) → **Create Database** → **Postgres**
4. **Configure:**
   - Nome: `meu-site-produtor-db` (ou qualquer nome)
   - Região: Escolha a mais próxima (ex: `us-east-1`)
   - Clique em **Create**
5. **Copie a Connection String:**
   - Após criar, vá em **Settings** → **.env.local**
   - Copie a linha `POSTGRES_PRISMA_URL` ou `POSTGRES_URL_NON_POOLING`
   - **IMPORTANTE:** Esta será sua `DATABASE_URL` no Vercel

### Opção 2: Supabase (Alternativa Gratuita)

1. **Acesse:** https://supabase.com
2. **Crie uma conta** (gratuita até 500MB)
3. **Crie um novo projeto:**
   - Nome: `meu-site-produtor`
   - Senha do banco: (anote bem!)
   - Região: Escolha a mais próxima
4. **Copie a Connection String:**
   - Vá em **Settings** → **Database**
   - Copie a **Connection string** (URI)
   - Formato: `postgresql://postgres:[SENHA]@db.xxxxx.supabase.co:5432/postgres`

### Opção 3: Neon (Alternativa Gratuita)

1. **Acesse:** https://neon.tech
2. **Crie uma conta** (gratuita até 3GB)
3. **Crie um projeto**
4. **Copie a Connection String:**
   - Vá em **Dashboard** → Seu projeto → **Connection Details**
   - Copie a connection string

**✅ Após criar o banco, você terá uma `DATABASE_URL` como:**
```
postgresql://user:password@host:5432/database?schema=public
```

**⚠️ GUARDE ESTA STRING! Você precisará dela no próximo passo.**

---

## 🔐 PASSO 3: Configurar Variáveis de Ambiente no Vercel

### 3.1. Acessar Vercel Dashboard

1. **Acesse:** https://vercel.com/dashboard
2. **Faça login** (ou crie conta se necessário)

### 3.2. Conectar Repositório (Se ainda não conectou)

1. Clique em **Add New Project**
2. Conecte seu repositório GitHub
3. Selecione: `rvits/meu-site-produtor`
4. Clique em **Import**

### 3.3. Configurar Variáveis de Ambiente

**No projeto do Vercel, vá em:**
**Settings** → **Environment Variables**

**Adicione cada variável abaixo:**

#### 1. DATABASE_URL
```
Valor: [Cole a connection string do banco PostgreSQL que você criou]
Ambiente: Production, Preview, Development (marque todos)
```

#### 2. SUPPORT_EMAIL
```
Valor: thouse.rec.tremv@gmail.com
Ambiente: Production, Preview, Development
```

#### 3. SUPPORT_EMAIL_PASSWORD
```
Valor: kjpexhpoqeqxycza
Ambiente: Production, Preview, Development
```

#### 4. SUPPORT_DEST_EMAIL
```
Valor: thouse.rec.tremv@gmail.com
Ambiente: Production, Preview, Development
```

#### 5. ASAAS_API_KEY
```
Valor: $aact_YTU5YTE0M2M2N2I4MTIxNzliZDkxYWE5Y2I2NDRjMDM6OjAwMDAwMDAwMDAwMDAwNzU3NDY6OiRhYWNoXzE4YzM0NDNhLWE3YjEtNDY5ZC05YjM5LWM5ZDFhNzI4YjFjYw==
Ambiente: Production, Preview, Development
```

#### 6. OPENAI_API_KEY
```
Valor: [Sua chave da OpenAI - começa com sk-proj-...]
Ambiente: Production, Preview, Development
```

#### 7. NODE_ENV
```
Valor: production
Ambiente: Production (apenas)
```

**✅ Após adicionar todas as variáveis, clique em "Save"**

---

## 🗄️ PASSO 4: Aplicar Schema no Banco de Produção

### Opção A: Via Vercel CLI (Recomendado)

1. **Instalar Vercel CLI:**
```bash
npm install -g vercel
```

2. **Fazer login:**
```bash
vercel login
```

3. **Baixar variáveis de ambiente:**
```bash
vercel env pull .env.local
```

4. **Aplicar schema:**
```bash
npx prisma db push
```

### Opção B: Manual (Se não tiver Vercel CLI)

1. **Criar arquivo temporário `.env.production`:**
```env
DATABASE_URL="[Cole a connection string do banco PostgreSQL]"
```

2. **Aplicar schema:**
```bash
# Windows PowerShell
$env:DATABASE_URL="[sua connection string]"
npx prisma db push

# OU criar arquivo .env.production e executar:
npx prisma db push --schema=./prisma/schema.prisma
```

**⚠️ IMPORTANTE:** 
- Use a `DATABASE_URL` do banco de **produção** (não a local!)
- Isso criará todas as tabelas no banco de produção

**✅ Após executar, você verá:**
```
✔ Generated Prisma Client
✔ Database schema is up to date
```

---

## 🚀 PASSO 5: Fazer Deploy

### 5.1. No Vercel Dashboard

1. **Vá em:** Deployments (menu lateral)
2. **Clique em:** "Deploy" ou "Redeploy" (se já tiver um deploy)
3. **Aguarde o build completar**

### 5.2. Verificar Build

Durante o build, você verá:
- ✅ Installing dependencies
- ✅ Running "prisma generate"
- ✅ Running "next build"
- ✅ Build completed

**Se houver erros:**
- Verifique os logs no Vercel
- Verifique se todas as variáveis de ambiente estão configuradas
- Verifique se a `DATABASE_URL` está correta

### 5.3. Testar Site

Após o deploy completar:
1. Clique no link do deploy (ex: `https://meu-site-produtor.vercel.app`)
2. Teste as funcionalidades:
   - ✅ Login/Registro
   - ✅ Chat
   - ✅ FAQ
   - ✅ Agendamentos
   - ✅ Pagamentos

---

## 🔗 PASSO 6: Atualizar Webhooks do Asaas

### 6.1. Obter URL do Site

Após o deploy, você terá uma URL como:
```
https://meu-site-produtor.vercel.app
```

### 6.2. Atualizar no Asaas

1. **Acesse:** https://www.asaas.com (painel do Asaas)
2. **Vá em:** Integrações → **Webhooks**
3. **Configure a URL:**
   ```
   https://seu-dominio.vercel.app/api/webhooks/asaas
   ```
   (Substitua `seu-dominio` pela URL real do seu site)
4. **Salve** as configurações

**✅ Pronto! O webhook agora apontará para o site em produção.**

---

## ✅ Checklist Final

- [ ] ✅ Código commitado e no GitHub
- [ ] ✅ Banco PostgreSQL criado
- [ ] ✅ `DATABASE_URL` configurada no Vercel
- [ ] ✅ Todas as variáveis de ambiente configuradas
- [ ] ✅ Schema aplicado no banco de produção
- [ ] ✅ Deploy realizado com sucesso
- [ ] ✅ Site funcionando
- [ ] ✅ Webhooks do Asaas atualizados

---

## 🐛 Troubleshooting

### Erro: "Prisma Client not generated"
**Solução:** O build command já inclui `prisma generate`. Se persistir, verifique os logs.

### Erro: "Database connection failed"
**Solução:**
- Verifique se a `DATABASE_URL` está correta
- Verifique se o banco permite conexões externas
- Se usar Supabase/Neon, verifique se o IP está na whitelist

### Erro: "Table does not exist"
**Solução:** Execute `npx prisma db push` novamente apontando para produção.

---

**🎉 Pronto! Seu site está no ar!**
