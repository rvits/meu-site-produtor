# 🗄️ Configurar Neon - Passo a Passo

## ✅ Você já criou o banco no Neon!

Agora vamos copiar a connection string:

### 1. Na página do Neon (onde você está agora):

1. **Clique no botão "Show secret"** (ícone de olho) ao lado de "Copy Snippet"
2. **Você verá a `DATABASE_URL` completa**, algo como:
   ```
   postgresql://usuario:senha@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. **Clique em "Copy Snippet"** para copiar tudo
4. **OU copie manualmente a linha `DATABASE_URL=...`** (sem os comentários)

### 2. Guarde essa string em um lugar seguro!

Você precisará dela nos próximos passos.

---

## ⚠️ IMPORTANTE:

- Use a `DATABASE_URL` (não a `DATABASE_URL_UNPOOLED`)
- A string deve começar com `postgresql://`
- Guarde essa string, você precisará colar no Vercel

---

## 📋 Próximos Passos:

1. ✅ Copiar `DATABASE_URL` do Neon
2. ⏳ Conectar repositório no Vercel
3. ⏳ Configurar variáveis de ambiente no Vercel
4. ⏳ Aplicar schema no banco Neon
5. ⏳ Fazer deploy

---

**Depois de copiar a DATABASE_URL, me avise e continuamos!**
