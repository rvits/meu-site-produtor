# 🚀 Fazer Deploy no Vercel

## 📋 Passo a Passo

### 1. No Vercel Dashboard

1. **Vá para o seu projeto** no Vercel
2. **Clique em "Deployments"** (no menu superior)
3. **Se já houver um deploy anterior:**
   - Clique nos **3 pontinhos (...)** ao lado do último deploy
   - Clique em **"Redeploy"**
   - Ou clique em **"Deploy"** se houver um botão

4. **Se for o primeiro deploy:**
   - O Vercel pode fazer deploy automaticamente após conectar o repositório
   - Ou clique em **"Deploy"** se houver um botão

### 2. Aguardar o Build

Você verá o progresso do build:
- ✅ Installing dependencies
- ✅ Running "prisma generate"
- ✅ Running "next build"
- ✅ Build completed

**⏱️ Tempo estimado:** 2-5 minutos

### 3. Verificar se Deu Certo

Após o build completar:
- ✅ Status: "Ready" (verde)
- ✅ Você verá uma URL: `https://seu-projeto.vercel.app`

### 4. Testar o Site

1. **Clique na URL** do deploy
2. **Teste as funcionalidades:**
   - ✅ Página inicial carrega
   - ✅ Login/Registro funciona
   - ✅ Chat funciona (se tiver OPENAI_API_KEY)
   - ✅ FAQ funciona
   - ✅ Agendamentos funcionam

---

## 🐛 Se Houver Erros

### Erro: "Prisma Client not generated"
**Solução:** O build command já inclui `prisma generate`. Se persistir, verifique os logs.

### Erro: "Database connection failed"
**Solução:**
- Verifique se a `DATABASE_URL` está correta no Vercel
- Verifique se o banco Neon está ativo

### Erro: "Build failed"
**Solução:**
- Clique nos logs do build para ver o erro específico
- Verifique se todas as variáveis de ambiente estão configuradas

---

## ✅ Próximo Passo Após Deploy

Depois que o deploy funcionar, precisamos:
1. ✅ Atualizar webhooks do Asaas
2. ✅ Testar todas as funcionalidades

---

**Vá para o Vercel e faça o deploy agora! Me avise quando terminar!**
