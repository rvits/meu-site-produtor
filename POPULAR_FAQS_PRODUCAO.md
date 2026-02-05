# 🔧 Popular FAQs no Banco de Produção

## ⚠️ Problema

As FAQs não estão aparecendo no site em produção porque o banco de dados PostgreSQL (no Vercel) não tem FAQs populadas.

## ✅ Solução: Migrar Todas as FAQs

### Passo 1: Obter DATABASE_URL de Produção

1. **Acesse:** https://vercel.com/dashboard
2. **Selecione seu projeto**
3. **Vá em "Settings" → "Environment Variables"**
4. **Copie o valor de `DATABASE_URL`**

### Passo 2: Configurar no .env Local

Adicione ou atualize a variável `DATABASE_URL` no seu `.env`:

```env
DATABASE_URL="postgresql://usuario:senha@host:porta/database?sslmode=require"
```

**⚠️ IMPORTANTE:** Certifique-se de que está usando a URL do banco de **produção**, não do local!

### Passo 3: Executar o Script

Execute o script para migrar todas as 50 FAQs:

```bash
node scripts/migrar-todas-faqs-producao.js
```

O script vai:
- ✅ Verificar FAQs existentes
- ✅ Criar FAQs que não existem
- ✅ Atualizar FAQs existentes (substituindo "Mercado Pago" por "Asaas")
- ✅ Mostrar relatório completo

---

## 📋 O que o Script Faz

1. **Migra 50 FAQs** do seed para produção:
   - 10 sobre Pagamentos
   - 10 sobre Agendamento
   - 10 sobre Planos
   - 10 sobre Login/Conta
   - 10 sobre Erros/Técnico

2. **Atualiza referências:**
   - Substitui "Mercado Pago" por "Asaas" nas respostas

3. **Não duplica:**
   - Verifica se a FAQ já existe antes de criar
   - Atualiza apenas se a resposta mudou

---

## 🔍 Verificar se Funcionou

1. **Acesse** `/faq` no site em produção
2. **Deve mostrar** FAQs agora
3. **Clique em "Mostrar todas"** para ver todas as 50 FAQs

---

## ⚠️ Importante

- **Certifique-se** de que `DATABASE_URL` está apontando para **produção**
- **Não execute** o script no banco local por engano
- **O script é seguro** - não apaga FAQs existentes, apenas cria/atualiza

---

**Após executar o script, as FAQs devem aparecer no site!**
