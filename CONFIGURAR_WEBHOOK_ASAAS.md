# 🔔 Configurar Webhook do Asaas

## 📋 O que você precisa configurar

Das três seções que você viu no painel do Asaas, você precisa configurar apenas **WEBHOOKS**.

### ✅ O que configurar:

#### 1. **Webhooks** (OBRIGATÓRIO) ⭐
Esta é a seção mais importante! É aqui que você configura para receber notificações quando os pagamentos forem confirmados.

**Como configurar:**

1. **Acesse a seção Webhooks**
   - No painel do Asaas, vá em **Integrações** → **Webhooks**
   - Clique em **"Adicionar Webhook"** (botão azul no canto superior direito)

2. **Preencher os dados:**
   - **URL do Webhook:**
     - Para desenvolvimento (localhost): `http://localhost:3000/api/webhooks/asaas`
     - Para produção (Vercel): `https://seudominio.com/api/webhooks/asaas`
     - ⚠️ **IMPORTANTE**: O Asaas não consegue acessar `localhost` em produção. Use uma URL pública ou um serviço como ngrok para testes locais.
   
   - **Eventos para receber:**
     - ✅ **PAYMENT_RECEIVED** (OBRIGATÓRIO - quando pagamento é confirmado)
     - ✅ **PAYMENT_CREATED** (opcional - quando pagamento é criado)
     - ✅ **PAYMENT_OVERDUE** (opcional - quando pagamento vence)
     - ✅ **PAYMENT_DELETED** (opcional - quando pagamento é deletado)
   
   - **Token de autenticação (Opcional):**
     - Você pode deixar vazio ou criar um token para segurança extra
     - Se criar, adicione no `.env` como `ASAAS_WEBHOOK_TOKEN`

3. **Salvar**
   - Clique em **"Salvar"** ou **"Adicionar"**

### ❌ O que NÃO precisa configurar:

#### 2. **Validação de Saque** (NÃO NECESSÁRIO)
- Esta seção é para controlar saques da sua conta
- **Não é necessária** para receber pagamentos
- Você pode deixar como está (desabilitado)

#### 3. **Logs de Requisições** (NÃO NECESSÁRIO)
- Esta seção é apenas para **visualizar** logs
- **Não precisa configurar nada**
- É útil para debugar problemas, mas não é obrigatório

## 🧪 Testando o Webhook Localmente

Se você está testando em `localhost`, o Asaas não consegue acessar diretamente. Você tem duas opções:

### Opção 1: Usar ngrok (Recomendado para testes)

✅ **O ngrok já está instalado!** (você executou `npm install -g ngrok`)

1. **Iniciar ngrok:**
   - Abra um **novo terminal** (deixe o servidor Next.js rodando em outro)
   - Execute:
     ```bash
     ngrok http 3000
     ```

2. **Você verá algo assim:**
   ```
   Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000
   ```

3. **Copiar a URL HTTPS gerada:**
   - Copie a URL que começa com `https://`
   - Exemplo: `https://abc123xyz.ngrok.io`

4. **Configurar no Asaas:**
   - URL do Webhook: `https://abc123xyz.ngrok.io/api/webhooks/asaas`
   - ⚠️ **IMPORTANTE**: Substitua `abc123xyz.ngrok.io` pela URL que o ngrok gerou!
   - ⚠️ **IMPORTANTE**: Adicione `/api/webhooks/asaas` no final!

📖 **Guia detalhado de preenchimento:** Veja o arquivo `PREENCHER_WEBHOOK_ASAAS.md`

### Opção 2: Testar em Produção

Se você já tem o site no Vercel ou outro servidor:

1. Use a URL de produção:
   - Exemplo: `https://seudominio.com/api/webhooks/asaas`

2. Configure no Asaas com esta URL

## ✅ Checklist de Configuração

- [ ] Token de API criado com permissão **PAYMENT:WRITE** ✅ (Você já fez!)
- [ ] Token atualizado no arquivo `.env` ✅
- [ ] Webhook configurado no painel do Asaas ⚠️ (FALTA FAZER)
- [ ] URL do webhook apontando para `/api/webhooks/asaas` ⚠️ (FALTA FAZER)
- [ ] Evento `PAYMENT_RECEIVED` selecionado no webhook ⚠️ (FALTA FAZER)

## 🎯 Resumo

**Para usar o Asaas, você precisa:**

1. ✅ Token de API com `PAYMENT:WRITE` (você já tem!)
2. ⚠️ **Webhook configurado** (você precisa fazer isso agora)
3. ❌ Validação de saque (não precisa)
4. ❌ Logs (não precisa configurar, só visualizar)

## 📝 Próximos Passos

1. Configure o Webhook no painel do Asaas
2. Se estiver testando localmente, use ngrok
3. Teste um pagamento
4. Verifique se o webhook está recebendo as notificações (veja os logs no terminal)
