# 📝 Como Preencher o Formulário de Webhook do Asaas

## 🚀 Passo a Passo Detalhado

### 1️⃣ **Nome do Webhook**
- **Campo:** "Nome do Webhook"
- **Valor:** `THouse-rec` (ou qualquer nome que você quiser, máximo 50 caracteres)
- ✅ Você já preencheu corretamente!

### 2️⃣ **URL do Webhook** ⚠️ IMPORTANTE

**Primeiro, você precisa iniciar o ngrok:**

1. **Abra um novo terminal** (deixe o servidor Next.js rodando em outro terminal)
2. **Execute o ngrok:**
   ```bash
   ngrok http 3000
   ```
3. **Você verá algo assim:**
   ```
   Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000
   ```
4. **Copie a URL HTTPS** (a que começa com `https://`)
   - Exemplo: `https://abc123xyz.ngrok.io`

**Agora preencha o campo:**
- **Campo:** "URL do Webhook"
- **Valor:** `https://abc123xyz.ngrok.io/api/webhooks/asaas`
  - ⚠️ **IMPORTANTE**: Substitua `abc123xyz.ngrok.io` pela URL que o ngrok gerou para você!
  - ⚠️ **IMPORTANTE**: Adicione `/api/webhooks/asaas` no final!

**Exemplo completo:**
```
https://abc123xyz.ngrok.io/api/webhooks/asaas
```

### 3️⃣ **E-mail**
- **Campo:** "E-mail"
- **Valor:** Seu email (ex: `thouse.rec.tremv@gmail.com`)
- **Para que serve:** Você receberá notificações se o webhook falhar

### 4️⃣ **Versão da API**
- **Campo:** "Versão da API"
- **Valor:** Selecione **`v3`** (versão mais recente)
- ✅ Escolha `v3` no dropdown

### 5️⃣ **Tipo de envio**
- **Campo:** "Tipo de envio"
- **Valor:** Selecione **`Não sequencial`**
- **Por quê:** Mais rápido e eficiente para a maioria dos casos

### 6️⃣ **Adicionar Eventos** ⚠️ MUITO IMPORTANTE

Você precisa selecionar os eventos que o webhook vai receber. **Selecione pelo menos:**

- ✅ **PAYMENT_RECEIVED** (OBRIGATÓRIO - quando pagamento é confirmado)
- ✅ **PAYMENT_CREATED** (opcional - quando pagamento é criado)
- ✅ **PAYMENT_OVERDUE** (opcional - quando pagamento vence)

**Como selecionar:**
1. Clique em "Adicionar Eventos"
2. Procure por eventos relacionados a **PAYMENT** (Pagamento)
3. Marque pelo menos **PAYMENT_RECEIVED**
4. Você pode marcar outros também se quiser

## ✅ Resumo do Preenchimento

| Campo | Valor |
|-------|-------|
| **Nome do Webhook** | `THouse-rec` |
| **URL do Webhook** | `https://SUA-URL-NGROK.ngrok.io/api/webhooks/asaas` |
| **E-mail** | Seu email |
| **Versão da API** | `v3` |
| **Tipo de envio** | `Não sequencial` |
| **Eventos** | ✅ `PAYMENT_RECEIVED` (obrigatório) |

## 🧪 Testando

1. **Inicie o ngrok** (em um terminal separado):
   ```bash
   ngrok http 3000
   ```

2. **Copie a URL HTTPS** que o ngrok gerar

3. **Preencha o formulário** do Asaas com a URL completa:
   ```
   https://SUA-URL-NGROK.ngrok.io/api/webhooks/asaas
   ```

4. **Salve o webhook** no Asaas

5. **Teste um pagamento** e verifique se o webhook recebe a notificação (veja os logs no terminal do Next.js)

## ⚠️ IMPORTANTE

- O ngrok precisa estar **rodando** enquanto você testa
- Se você fechar o ngrok, a URL muda e você precisa atualizar no Asaas
- Para produção, use a URL do seu servidor (Vercel, etc.) em vez do ngrok
