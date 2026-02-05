# ⚡ Solução Rápida: Erro SSL PostgreSQL

## 🎯 Solução Mais Rápida:

### **Opção 1: Cancelar o PEM e Configurar Direto (Recomendado)**

1. **Clique em "Cancel" no instalador do PEM**
2. **O PostgreSQL já está instalado e funcionando!**
3. **Vamos configurar direto no projeto**

O PEM (PostgreSQL Enterprise Manager) é **opcional** e não é necessário para usar o PostgreSQL com Prisma/Next.js.

---

### **Opção 2: Se REALMENTE Precisar do PEM**

#### Passo 1: Editar `pg_hba.conf`

1. **Localizar o arquivo:**
   - Abra o Explorador de Arquivos
   - Vá para: `C:\Program Files\PostgreSQL\18\data\`
   - Procure por `pg_hba.conf`

2. **Editar como Administrador:**
   - Clique com botão direito → "Abrir com" → "Bloco de Notas"
   - **IMPORTANTE:** Execute o Bloco de Notas como Administrador primeiro!

3. **Alterar as linhas:**
   Procure por:
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   host    all             all             ::1/128                 scram-sha-256
   ```

   **Mude para:**
   ```
   host    all             all             127.0.0.1/32            trust
   host    all             all             ::1/128                 trust
   ```

4. **Salvar o arquivo**

#### Passo 2: Reiniciar PostgreSQL

1. **Pressione `Win + R`**
2. **Digite:** `services.msc`
3. **Pressione Enter**
4. **Procure por "PostgreSQL"**
5. **Clique com botão direito → "Reiniciar"**

#### Passo 3: Tentar Novamente

Volte ao instalador do PEM e tente novamente.

---

## 💡 Minha Recomendação:

**CANCELAR o PEM** e seguir direto para configurar o projeto. O PEM é uma ferramenta de gerenciamento visual, mas não é necessária. Você pode usar:

- **Prisma Studio** (já vem com o Prisma)
- **pgAdmin** (se quiser uma interface visual)
- **Ou apenas o terminal/linha de comando**

---

## 🚀 Próximo Passo Após Cancelar:

1. **Criar o banco de dados:**
   ```bash
   psql -U postgres
   CREATE DATABASE thouse_rec;
   \q
   ```

2. **Configurar `.env`:**
   ```env
   DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/thouse_rec"
   ```

3. **Seguir o guia de migração**

---

**Recomendo cancelar o PEM e seguir direto! É mais rápido e você não precisa dele.**
