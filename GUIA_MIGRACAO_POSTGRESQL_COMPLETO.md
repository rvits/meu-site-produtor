# 🐘 Guia Completo de Migração: SQLite → PostgreSQL

Este guia vai te ajudar a migrar todo o banco de dados de SQLite para PostgreSQL mantendo **TODAS** as funcionalidades.

---

## 📋 Pré-requisitos

1. ✅ Node.js instalado
2. ✅ PostgreSQL instalado ou acesso a um banco PostgreSQL (Supabase, Neon, Vercel Postgres, etc.)
3. ✅ Backup do banco SQLite atual (o arquivo `prisma/dev.db`)

---

## 🚀 Passo a Passo Completo

### **Passo 1: Escolher e Configurar PostgreSQL**

#### Opção A: PostgreSQL Local

1. **Instalar PostgreSQL:**
   - Windows: https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. **Criar banco de dados:**
   ```bash
   # Conectar ao PostgreSQL
   psql -U postgres
   
   # Criar banco
   CREATE DATABASE thouse_rec;
   
   # Sair
   \q
   ```

3. **Connection String:**
   ```
   postgresql://postgres:senha@localhost:5432/thouse_rec?schema=public
   ```

#### Opção B: PostgreSQL na Nuvem (Recomendado para Vercel)

**Opções gratuitas:**
- **Supabase**: https://supabase.com (500MB grátis)
- **Neon**: https://neon.tech (3GB grátis)
- **Vercel Postgres**: Integração nativa com Vercel
- **Railway**: https://railway.app (gratuito com limites)

**Como obter connection string:**
1. Crie uma conta no serviço escolhido
2. Crie um novo projeto/banco
3. Copie a connection string fornecida
4. Formato: `postgresql://user:password@host:5432/database?schema=public`

---

### **Passo 2: Atualizar Schema do Prisma**

✅ **JÁ FEITO!** O schema já foi atualizado para PostgreSQL.

O arquivo `prisma/schema.prisma` agora usa:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

### **Passo 3: Configurar Variável de Ambiente**

1. **Abra o arquivo `.env` ou `.env.local`** na raiz do projeto

2. **Adicione a connection string do PostgreSQL:**
   ```env
   # PostgreSQL (substitua pelos seus dados reais)
   DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
   
   # Mantenha as outras variáveis
   SUPPORT_EMAIL=thouse.rec.tremv@gmail.com
   SUPPORT_EMAIL_PASSWORD=kjpexhpoqeqxycza
   SUPPORT_DEST_EMAIL=thouse.rec.tremv@gmail.com
   ASAAS_API_KEY=...
   OPENAI_API_KEY=...
   ```

3. **Salve o arquivo**

---

### **Passo 4: Instalar Driver PostgreSQL**

```bash
npm install pg @types/pg
```

---

### **Passo 5: Gerar Prisma Client para PostgreSQL**

```bash
npx prisma generate
```

Isso vai regenerar o Prisma Client para usar PostgreSQL.

---

### **Passo 6: Criar Estrutura no PostgreSQL**

```bash
npx prisma db push
```

Isso vai criar todas as tabelas, índices e relações no PostgreSQL.

**⚠️ ATENÇÃO:** Se aparecer avisos sobre perda de dados, você pode aceitar (y) porque ainda não há dados no PostgreSQL.

---

### **Passo 7: Migrar Dados do SQLite para PostgreSQL**

**IMPORTANTE:** Antes de migrar, faça um backup do SQLite:

```bash
# Fazer backup do SQLite
cp prisma/dev.db prisma/dev.db.backup
```

**Agora execute o script de migração:**

```bash
node scripts/migrar-para-postgresql-v2.js
```

**OU use o comando npm:**

```bash
npm run migrate:postgresql
```

Este script vai:
- ✅ Conectar ao SQLite (banco antigo)
- ✅ Conectar ao PostgreSQL (banco novo)
- ✅ Migrar todos os dados de todas as tabelas
- ✅ Manter todos os relacionamentos
- ✅ Mostrar progresso de cada tabela

**Tempo estimado:** 1-5 minutos (dependendo da quantidade de dados)

---

### **Passo 8: Verificar Migração**

1. **Testar conexão:**
   ```bash
   npx prisma studio
   ```
   
   Isso vai abrir o Prisma Studio conectado ao PostgreSQL. Verifique se todos os dados estão lá.

2. **Testar aplicação:**
   ```bash
   npm run dev
   ```
   
   Teste as principais funcionalidades:
   - ✅ Login/Registro
   - ✅ Agendamentos
   - ✅ Pagamentos
   - ✅ Chat
   - ✅ FAQ
   - ✅ Planos

---

### **Passo 9: Limpar e Finalizar**

Após confirmar que tudo está funcionando:

1. **Manter backup do SQLite** (não deletar ainda)
2. **Testar por alguns dias** antes de remover o SQLite
3. **Atualizar documentação** se necessário

---

## 🔧 Solução de Problemas

### ❌ Erro: "Can't reach database server"

**Solução:**
- Verifique se o PostgreSQL está rodando
- Verifique se a connection string está correta
- Verifique firewall/portas (5432)

### ❌ Erro: "relation already exists"

**Solução:**
- O banco já tem tabelas. Use `npx prisma migrate reset` para limpar (CUIDADO: apaga dados!)
- Ou use `npx prisma db push --force-reset` (também apaga dados!)

### ❌ Erro: "column does not exist"

**Solução:**
- Execute `npx prisma db push` novamente
- Verifique se o schema está atualizado

### ❌ Erro na migração de dados

**Solução:**
- Verifique se o PostgreSQL está acessível
- Verifique se há dados duplicados (IDs conflitantes)
- Execute o script novamente (ele usa `upsert`, então é seguro)

### ❌ Dados não aparecem após migração

**Solução:**
- Verifique os logs do script de migração
- Verifique se há erros específicos
- Use `npx prisma studio` para inspecionar o banco

---

## 📊 Checklist Final

Antes de considerar a migração completa:

- [ ] PostgreSQL configurado e acessível
- [ ] `DATABASE_URL` configurada no `.env`
- [ ] Schema atualizado para PostgreSQL
- [ ] Prisma Client regenerado
- [ ] Estrutura criada no PostgreSQL (`npx prisma db push`)
- [ ] Dados migrados do SQLite
- [ ] Aplicação testada e funcionando
- [ ] Backup do SQLite mantido
- [ ] Todas as funcionalidades testadas

---

## 🎯 Próximos Passos

Após a migração bem-sucedida:

1. **Deploy no Vercel:**
   - Configure `DATABASE_URL` nas variáveis de ambiente do Vercel
   - Faça o deploy normalmente

2. **Monitoramento:**
   - Monitore performance do banco
   - Verifique logs de erro
   - Ajuste índices se necessário

3. **Otimizações:**
   - Configure connection pooling
   - Ajuste timeouts se necessário
   - Configure backups automáticos

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas:

1. Verifique os logs do script de migração
2. Verifique se o PostgreSQL está acessível
3. Teste a connection string manualmente
4. Verifique se todas as dependências estão instaladas

---

**Boa sorte com a migração! 🚀**
