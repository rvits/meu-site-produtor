# Configuração do Infinity Pay

## ✅ Implementação Completa

A integração com Infinity Pay foi implementada como alternativa ao Mercado Pago. O sistema agora detecta automaticamente qual provedor está configurado e usa o apropriado.

## 📋 Como Configurar

### 1. Obter Credenciais do Infinity Pay

1. Acesse o painel do Infinity Pay (URL será fornecida pela documentação oficial)
2. Crie uma conta ou faça login
3. Gere uma API Key (chave de API)
4. Copie a API Key

### 2. Configurar no `.env`

Adicione a seguinte variável no arquivo `.env`:

```env
# Infinity Pay (prioridade se configurado)
INFINITYPAY_API_KEY=sua_api_key_aqui

# Mercado Pago (usado se Infinity Pay não estiver configurado)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
```

### 3. Prioridade de Provedores

O sistema usa a seguinte lógica:
- Se `INFINITYPAY_API_KEY` estiver configurado → usa **Infinity Pay**
- Se apenas `MERCADOPAGO_ACCESS_TOKEN` estiver configurado → usa **Mercado Pago**
- Se nenhum estiver configurado → retorna erro

## 🔧 Ajustes Necessários

A implementação atual usa uma estrutura genérica baseada em padrões comuns de APIs de pagamento. **Você precisará ajustar** conforme a documentação oficial do Infinity Pay:

### Arquivo: `src/app/lib/payment-providers.ts`

Ajuste os seguintes pontos:

1. **URL da API** (linhas ~30-33):
   ```typescript
   this.apiUrl = isTest 
     ? "https://api.infinitypay.com.br/v1" // Ajustar conforme documentação
     : "https://api.infinitypay.com.br/v1"; // Ajustar conforme documentação
   ```

2. **Estrutura do Payload** (linhas ~40-55):
   - Ajuste os campos do `payload` conforme a API do Infinity Pay espera
   - Verifique se é `Authorization: Bearer` ou `X-API-Key` no header
   - Ajuste os nomes dos campos (ex: `checkout_url`, `payment_url`, etc.)

3. **Estrutura de Resposta** (linhas ~70-75):
   - Ajuste como extrair a URL de checkout da resposta
   - Verifique os nomes dos campos retornados pela API

### Exemplo de Ajuste

Se a documentação do Infinity Pay especificar:

```json
// Request
POST /v1/payments
{
  "amount": 100.00,
  "currency": "BRL",
  "customer": { ... },
  "items": [ ... ]
}

// Response
{
  "id": "pay_123",
  "checkout_url": "https://checkout.infinitypay.com.br/..."
}
```

Ajuste o código em `payment-providers.ts` para corresponder a essa estrutura.

## 🧪 Testando

1. Configure a `INFINITYPAY_API_KEY` no `.env`
2. Reinicie o servidor: `npm run dev`
3. Tente fazer um pagamento
4. Verifique os logs no console para ver a requisição e resposta

## 📝 Notas

- A implementação mantém compatibilidade total com o Mercado Pago
- Você pode alternar entre provedores apenas mudando as variáveis de ambiente
- Os webhooks precisarão ser configurados separadamente (criar rota `/api/webhooks/infinitypay/route.ts`)

## 🔗 Próximos Passos

1. Obter documentação oficial do Infinity Pay
2. Ajustar a estrutura de request/response conforme documentação
3. Configurar webhooks para receber notificações de pagamento
4. Testar fluxo completo de pagamento
