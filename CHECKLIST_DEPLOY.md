# ✅ Checklist de Deploy - Vercel

## 📋 Passo a Passo Completo

### ✅ PASSO 1: Preparar Código (Fazer Agora)
- [ ] Fazer commit das mudanças
- [ ] Fazer push para o GitHub

### ⏳ PASSO 2: Criar Banco PostgreSQL em Produção
- [ ] Escolher provedor (Vercel Postgres, Supabase, Neon, etc.)
- [ ] Criar banco de dados
- [ ] Copiar connection string (DATABASE_URL)

### ⏳ PASSO 3: Configurar Variáveis de Ambiente no Vercel
- [ ] DATABASE_URL (do banco de produção)
- [ ] SUPPORT_EMAIL
- [ ] SUPPORT_EMAIL_PASSWORD
- [ ] SUPPORT_DEST_EMAIL
- [ ] ASAAS_API_KEY
- [ ] OPENAI_API_KEY
- [ ] NODE_ENV=production

### ⏳ PASSO 4: Conectar Repositório no Vercel
- [ ] Criar conta/login no Vercel
- [ ] Conectar repositório GitHub
- [ ] Configurar projeto

### ⏳ PASSO 5: Aplicar Schema no Banco de Produção
- [ ] Executar `npx prisma db push` apontando para produção

### ⏳ PASSO 6: Fazer Deploy
- [ ] Iniciar deploy no Vercel
- [ ] Verificar build
- [ ] Testar site

### ⏳ PASSO 7: Atualizar Webhooks do Asaas
- [ ] Atualizar URL do webhook para o domínio do Vercel

---

**Status Atual:** Pronto para começar o PASSO 1
