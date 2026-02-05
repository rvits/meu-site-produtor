# 🔧 Corrigir Erro SSL do PostgreSQL

## ❌ Erro:
```
psql: error: connection to server at "localhost" (::1), port 5432 failed: 
server does not support SSL, but SSL was required
```

## ✅ Solução: Configurar PostgreSQL para Aceitar Conexões sem SSL

### Passo 1: Encontrar o arquivo `pg_hba.conf`

O arquivo `pg_hba.conf` controla as conexões ao PostgreSQL. Ele geralmente está em:

**Windows (instalação padrão):**
```
C:\Program Files\PostgreSQL\18\data\pg_hba.conf
```

**OU:**
```
C:\Program Files (x86)\PostgreSQL\18\data\pg_hba.conf
```

### Passo 2: Editar o arquivo `pg_hba.conf`

1. **Abra o arquivo como Administrador:**
   - Clique com botão direito no arquivo
   - Escolha "Abrir com" → "Bloco de Notas"
   - **IMPORTANTE:** Execute o Bloco de Notas como Administrador primeiro!

2. **Encontre as linhas que começam com `host`:**
   Procure por linhas como:
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   host    all             all             ::1/128                 scram-sha-256
   ```

3. **Altere para `trust` ou `md5` (sem SSL):**
   ```
   host    all             all             127.0.0.1/32            trust
   host    all             all             ::1/128                 trust
   ```

   **OU se preferir manter autenticação:**
   ```
   host    all             all             127.0.0.1/32            md5
   host    all             all             ::1/128                 md5
   ```

### Passo 3: Editar o arquivo `postgresql.conf`

1. **Encontre o arquivo:**
   ```
   C:\Program Files\PostgreSQL\18\data\postgresql.conf
   ```

2. **Procure por `ssl =`:**
   ```
   ssl = off
   ```

   Se estiver `on`, mude para `off`.

### Passo 4: Reiniciar o PostgreSQL

1. **Abra o "Services" (Serviços):**
   - Pressione `Win + R`
   - Digite: `services.msc`
   - Pressione Enter

2. **Encontre o serviço PostgreSQL:**
   - Procure por "postgresql" ou "PostgreSQL 18"
   - Clique com botão direito → "Restart" (Reiniciar)

### Passo 5: Testar a Conexão

Depois de reiniciar, tente novamente no instalador do PEM.

---

## 🚀 Alternativa Rápida: Usar Connection String sem SSL

Se você quiser pular o PEM e ir direto para configurar o projeto, use esta connection string no `.env`:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/thouse_rec?sslmode=disable"
```

O `?sslmode=disable` desabilita SSL na connection string.

---

## ⚠️ Nota de Segurança

Para **desenvolvimento local**, desabilitar SSL é aceitável. Para **produção**, sempre use SSL!

---

**Depois de fazer essas alterações, reinicie o PostgreSQL e tente novamente!**
