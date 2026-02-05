# 🔧 Resolver: FAQ sem Perguntas e Tornar Usuário Admin

## Problema 1: FAQ não está mostrando perguntas

O FAQ pode não estar mostrando perguntas porque:
1. O banco de dados de produção (PostgreSQL) não tem FAQs populadas
2. As FAQs precisam ser criadas no banco de produção

## Problema 2: Usuário não é admin

O email `vicperra@gmail.com` precisa ter `role = "ADMIN"` no banco de dados.

---

## ✅ Solução

### Passo 1: Tornar Usuário Admin

Execute o script para tornar o usuário admin:

```bash
node scripts/tornar-admin.js
```

Isso vai:
- Buscar o usuário com email `vicperra@gmail.com`
- Atualizar o `role` para `"ADMIN"`
- Mostrar confirmação

### Passo 2: Popular FAQs no Banco de Produção

As FAQs precisam estar no banco de dados de produção. Você tem duas opções:

#### Opção A: Criar FAQs via Admin Panel (Recomendado)

1. **Faça login com `vicperra@gmail.com`** (agora como admin)
2. **Acesse `/admin/faq`**
3. **Crie FAQs manualmente** ou responda perguntas de usuários que serão publicadas

#### Opção B: Executar Seed (se houver)

Se houver um seed com FAQs, você pode executar:

```bash
npm run seed
```

**⚠️ ATENÇÃO:** Isso pode apagar dados existentes. Verifique o arquivo `prisma/seed.js` antes.

#### Opção C: Migrar FAQs do SQLite para PostgreSQL

Se você tem FAQs no banco local (SQLite), pode migrar:

1. **Exportar FAQs do SQLite:**
   ```bash
   # Criar script para exportar FAQs
   ```

2. **Importar para PostgreSQL:**
   ```bash
   # Criar script para importar FAQs
   ```

---

## 🔍 Verificar se Funcionou

### Verificar Admin:
1. Faça login com `vicperra@gmail.com`
2. Tente acessar `/admin`
3. Deve funcionar sem erro de "Acesso negado"

### Verificar FAQ:
1. Acesse `/faq`
2. Deve mostrar FAQs se houver no banco
3. Se não houver, crie algumas via Admin Panel

---

## 📝 Próximos Passos

Após tornar admin:
1. Acesse `/admin/faq/pendentes`
2. Responda perguntas de usuários
3. Publique as respostas no FAQ público

---

**Execute o script primeiro e me avise o resultado!**
