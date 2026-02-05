# 🔧 Solução para Tunnel Instável

## Problema
Quando o LocalTunnel ou ngrok está instável (erro 503), o redirecionamento automático do Asaas após o pagamento pode não funcionar.

## Solução Implementada

### 1. **Página de Verificação de Pagamento**
Criada a página `/pagamentos/verificar` que:
- Verifica o status do pagamento diretamente no Asaas
- Mostra o status em tempo real
- Redireciona automaticamente para a página de sucesso quando confirmado

### 2. **Página de Sucesso Melhorada**
A página `/pagamentos/sucesso` agora:
- Verifica automaticamente o status se receber um `paymentId`
- Mostra mensagens claras mesmo se o redirecionamento falhar
- Permite acesso manual mesmo sem redirecionamento

### 3. **API de Verificação**
Criada a API `/api/pagamentos/verificar` que:
- Busca o pagamento no banco de dados
- Se não encontrar, busca diretamente no Asaas
- Retorna o status atual do pagamento

## Como Usar

### Opção 1: Acesso Manual (Recomendado quando tunnel está instável)
1. Após realizar o pagamento no Asaas, anote o ID do pagamento (se disponível)
2. Acesse manualmente: `/pagamentos/sucesso?tipo=agendamento` ou `/pagamentos/sucesso?tipo=plano`
3. A página mostrará a confirmação de sucesso

### Opção 2: Verificação Automática
1. Se você tiver o ID do pagamento, acesse: `/pagamentos/verificar?paymentId=SEU_PAYMENT_ID&tipo=agendamento`
2. A página verificará automaticamente e redirecionará quando confirmado

### Opção 3: Verificar na Conta
1. Acesse `/conta` ou `/minha-conta`
2. Verifique se o pagamento aparece na lista de pagamentos
3. Se aparecer como confirmado, o agendamento/plano já foi criado

## Verificar Status do Pagamento

### Via API
```bash
GET /api/pagamentos/verificar?paymentId=SEU_PAYMENT_ID
```

Resposta:
```json
{
  "status": "RECEIVED",
  "paymentId": "pay_xxx",
  "amount": 100.00
}
```

## Status Possíveis

- `RECEIVED` ou `CONFIRMED`: Pagamento confirmado ✅
- `PENDING`: Pagamento pendente (aguardando confirmação) ⏳
- `OVERDUE`: Pagamento vencido ❌
- `REFUNDED`: Pagamento reembolsado 💰

## Notas Importantes

1. **Webhook sempre funciona**: Mesmo que o redirecionamento falhe, o webhook do Asaas sempre processa o pagamento e cria o agendamento/plano
2. **Emails são enviados**: Os emails de confirmação são enviados independentemente do redirecionamento
3. **Acesso manual sempre disponível**: Você pode sempre acessar `/pagamentos/sucesso` manualmente após o pagamento

## Reiniciar Tunnel

Se o tunnel estiver instável:

### LocalTunnel
```bash
# Parar o processo atual (Ctrl+C)
# Reiniciar
npx localtunnel --port 3000
```

### ngrok
```bash
# Parar o processo atual (Ctrl+C)
# Reiniciar
ngrok http 3000
```

Depois, atualize o `.env` com a nova URL:
```
NEXT_PUBLIC_SITE_URL=https://sua-nova-url.loca.lt
```

E atualize o domínio no painel do Asaas.
