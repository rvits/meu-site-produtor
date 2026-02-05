# 🔧 Como Processar Pagamento Manualmente (Quando Webhook Falha)

## ❌ Problema: Webhook Retornando 503

Quando o webhook do Asaas retorna erro **503 (Service Unavailable)**, significa que:
- O Asaas está tentando chamar o webhook
- Mas o servidor não está respondendo (tunnel instável ou servidor offline)

## ✅ Solução: Processar Manualmente

### Opção 1: Via API (Recomendado)

1. **Obter o ID do pagamento no Asaas:**
   - Acesse: https://www.asaas.com/ (ou sandbox)
   - Vá em **Cobranças**
   - Encontre o pagamento de R$ 5,00
   - Copie o ID (ex: `pay_xxxxx`)

2. **Processar via API:**
   
   **No terminal (PowerShell):**
   ```powershell
   # Substitua pay_xxxxx pelo ID real do pagamento
   $body = @{
       paymentId = "pay_xxxxx"
   } | ConvertTo-Json
   
   Invoke-RestMethod -Uri "http://localhost:3000/api/pagamentos/processar-manual" `
       -Method POST `
       -ContentType "application/json" `
       -Body $body
   ```
   
   **Ou via curl (se tiver):**
   ```bash
   curl -X POST http://localhost:3000/api/pagamentos/processar-manual \
     -H "Content-Type: application/json" \
     -d "{\"paymentId\": \"pay_xxxxx\"}"
   ```
   
   **Ou via Postman/Insomnia:**
   - URL: `POST http://localhost:3000/api/pagamentos/processar-manual`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "paymentId": "pay_xxxxx"
     }
     ```

3. **Verificar resultado:**
   - A resposta deve mostrar `success: true`
   - O campo `userPlan` deve mostrar o plano criado

### Opção 2: Via Interface Web (Futuro)

Uma página de admin será criada para processar pagamentos pela interface.

## 🔍 Como Encontrar o ID do Pagamento

### No Painel do Asaas:

1. Acesse: https://www.asaas.com/
2. Faça login
3. Vá em **Cobranças** (menu lateral)
4. Procure pelo pagamento de **R$ 5,00**
5. Clique no pagamento
6. O ID aparece no topo da página (formato: `pay_xxxxx`)

### Via API do Asaas:

```bash
# Listar últimos pagamentos
curl -X GET "https://sandbox.asaas.com/api/v3/payments?limit=10" \
  -H "access_token: SEU_TOKEN_AQUI"
```

## 📋 Checklist de Verificação

Após processar manualmente, verifique:

- [ ] O pagamento aparece na tabela `Payment` no banco
- [ ] O plano aparece na tabela `UserPlan` (se for pagamento de plano)
- [ ] O plano aparece na seção "Planos" do admin
- [ ] O plano aparece em "Minha Conta" → "Meus Planos"

## 🚨 Se Ainda Não Funcionar

1. **Verifique os logs do servidor:**
   - Procure por `[Processar Manual]` nos logs
   - Veja se há erros específicos

2. **Verifique o token do Asaas:**
   - Confirme que está no arquivo `.env`
   - Confirme que tem permissão `PAYMENT:WRITE`

3. **Verifique o metadata:**
   - O sistema busca o `PaymentMetadata` usando o `userId`
   - Se não encontrar, tenta valores padrão para teste

## 💡 Dica: Configurar Webhook Mais Confiável

Para evitar problemas futuros:

1. **Use um tunnel mais estável:**
   - **ngrok** (mais confiável que loca.lt)
   - **Cloudflare Tunnel** (gratuito e estável)
   - **Deploy em produção** (Vercel, Railway, etc.)

2. **Configure retry no Asaas:**
   - O Asaas tenta novamente automaticamente
   - Mas se o tunnel estiver offline, não funcionará

3. **Use processamento manual como fallback:**
   - Sempre verifique se o pagamento foi processado
   - Use a rota manual se necessário
