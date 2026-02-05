# 🔧 Configurar Admin no Banco de Produção

## ⚠️ Problema

O usuário `vicperra@gmail.com` não está associado como ADMIN no banco de produção (PostgreSQL no Vercel).

## ✅ Solução

### Opção 1: Executar Script Localmente (Recomendado)

1. **Configure a variável `DATABASE_URL` no `.env`** para apontar para o banco de **produção**:
   ```env
   DATABASE_URL="postgresql://usuario:senha@host:porta/database?sslmode=require"
   ```
   
   **Onde encontrar a DATABASE_URL de produção:**
   - Vercel Dashboard → Seu Projeto → Settings → Environment Variables
   - Ou no painel do seu provedor de PostgreSQL (Neon, Supabase, etc.)

2. **Execute o script:**
   ```bash
   node scripts/tornar-admin-producao.js
   ```

3. **Verifique o resultado:**
   - O script mostrará se o usuário foi encontrado e atualizado
   - Se não encontrar, listará os primeiros 10 usuários para você verificar

---

### Opção 2: Via SQL Direto (Alternativa)

Se você tiver acesso direto ao banco PostgreSQL:

```sql
UPDATE "User" 
SET role = 'ADMIN' 
WHERE email = 'vicperra@gmail.com';
```

---

### Opção 3: Via Vercel CLI (Se tiver acesso)

1. **Instale o Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Faça login:**
   ```bash
   vercel login
   ```

3. **Execute o script com as variáveis do Vercel:**
   ```bash
   vercel env pull .env.production
   # Configure DATABASE_URL no .env
   node scripts/tornar-admin-producao.js
   ```

---

## 🔍 Verificar se Funcionou

1. **Faça login** com `vicperra@gmail.com`
2. **Tente acessar** `/admin`
3. **Deve funcionar** sem erro de "Acesso negado"

---

## ⚠️ Importante

- **Certifique-se** de que `DATABASE_URL` está apontando para **produção**, não para local
- **Não execute** o script no banco local por engano
- **Verifique** o email antes de executar

---

**Após executar o script, teste o acesso ao admin!**
