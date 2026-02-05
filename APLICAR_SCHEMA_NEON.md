# 🗄️ Aplicar Schema no Banco Neon

## 📋 Passo a Passo

### Opção 1: Via Terminal (Recomendado)

1. **Abra o terminal** no diretório do projeto
2. **Configure temporariamente a DATABASE_URL do Neon:**
   ```powershell
   $env:DATABASE_URL="postgresql://neondb_owner:npg_5kOUmhWP1YiD@ep-soft-snow-acu3sq1b-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
   ```

3. **Aplique o schema:**
   ```powershell
   npx prisma db push
   ```

4. **Aguarde a conclusão:**
   - Você verá: `✔ Generated Prisma Client`
   - E: `✔ Database schema is up to date` ou `✔ Database schema pushed successfully`

### Opção 2: Criar arquivo temporário

1. **Crie um arquivo `.env.production`** na raiz do projeto:
   ```env
   DATABASE_URL=postgresql://neondb_owner:npg_5kOUmhWP1YiD@ep-soft-snow-acu3sq1b-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

2. **Execute:**
   ```powershell
   npx prisma db push
   ```

3. **Depois, delete o arquivo `.env.production`** (não commite ele!)

---

## ✅ O que isso faz?

- Cria todas as tabelas no banco Neon
- Configura os relacionamentos
- Prepara o banco para receber dados

---

## ⚠️ IMPORTANTE:

- Use a `DATABASE_URL` do Neon (não a local!)
- Isso criará as tabelas no banco de **produção**
- Não se preocupe, não vai apagar nada (o banco está vazio)

---

**Depois de executar, me avise o resultado!**
