# Configuração do Asaas

## ✅ Implementação Completa

A integração com **Asaas** foi implementada como provedor de pagamento principal. O sistema agora detecta automaticamente qual provedor está configurado e usa o apropriado, com prioridade: **Asaas > Infinity Pay > Mercado Pago**.

## 📋 Como Configurar

### 1. Criar Conta no Asaas

1. Acesse: https://www.asaas.com/
2. Clique em "Criar Conta" ou "Começar Grátis"
3. Preencha seus dados (CNPJ ou CPF)
4. Complete o cadastro e verifique seu email

### 2. Obter API Key (Token de Acesso)

1. Faça login no painel do Asaas
2. Vá em **"Integrações"** ou **"API"** no menu lateral
3. Clique em **"Criar Token de Acesso"** ou **"API Key"**
4. Copie o token gerado (formato: `$aact_YTU5YTE0M2M2N2I4MTIxNzliZDkxYWE5Y2I2NDRjMDM6OjAwMDAwMDAwMDAwMDAwNzU3NDY6OiRhYWNoXzE4YzM0NDNhLWE3YjEtNDY5ZC05YjM5LWM5ZDFhNzI4YjFjYw==`)
5. **IMPORTANTE**: Guarde este token com segurança, ele não será exibido novamente

### 3. Configurar no `.env`

Adicione a seguinte variável no arquivo `.env` na raiz do projeto:

```env
# Asaas (prioridade - será usado se configurado)
ASAAS_API_KEY=$aact_YTU5YTE0M2M2N2I4MTIxNzliZDkxYWE5Y2I2NDRjMDM6OjAwMDAwMDAwMDAwMDAwNzU3NDY6OiRhYWNoXzE4YzM0NDNhLWE3YjEtNDY5ZC05YjM5LWM5ZDFhNzI4YjFjYw==

# Infinity Pay (usado se Asaas não estiver configurado)
INFINITYPAY_API_KEY=sua_api_key_aqui

# Mercado Pago (usado se nenhum dos anteriores estiver configurado)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
```

### 4. Ambiente de Teste (Sandbox)

O Asaas possui um ambiente de **sandbox** para testes:

- **Sandbox**: https://sandbox.asaas.com/
- Crie uma conta separada no sandbox para testes
- Use o token do sandbox durante desenvolvimento
- O sistema detecta automaticamente se está em produção ou desenvolvimento

**Para usar o sandbox:**
- Configure `NODE_ENV=development` no `.env` (ou deixe sem configurar)
- Use o token do sandbox no `ASAAS_API_KEY`

**Para usar produção:**
- Configure `NODE_ENV=production` no `.env`
- Use o token de produção no `ASAAS_API_KEY`

## 🔧 Como Funciona

### Prioridade de Provedores

O sistema usa a seguinte lógica:
1. Se `ASAAS_API_KEY` estiver configurado → usa **Asaas** ✅
2. Se apenas `INFINITYPAY_API_KEY` estiver configurado → usa **Infinity Pay**
3. Se apenas `MERCADOPAGO_ACCESS_TOKEN` estiver configurado → usa **Mercado Pago**
4. Se nenhum estiver configurado → retorna erro

### Fluxo de Pagamento

1. **Cliente seleciona plano/agendamento** → Frontend
2. **Sistema cria checkout** → `/api/asaas/checkout` ou `/api/asaas/checkout-agendamento`
3. **Asaas retorna URL de pagamento** → `invoiceUrl` ou `bankSlipUrl`
4. **Cliente é redirecionado** → Para a página de pagamento do Asaas
5. **Cliente escolhe forma de pagamento** → Pix, Cartão, Boleto, etc.
6. **Asaas processa pagamento** → Webhook notifica o sistema
7. **Cliente retorna ao site** → Página de sucesso/falha

## 🧪 Testando

### 1. Teste Básico (Admin)

1. Configure a `ASAAS_API_KEY` no `.env`
2. Reinicie o servidor: `npm run dev`
3. Faça login como admin (`thouse.rec.tremv@gmail.com`)
4. Acesse `/planos` ou `/agendamento`
5. Você verá uma **box amarela de teste** com botão "Testar Pagamento - R$ 5,00"
6. Clique no botão e teste o fluxo completo

### 2. Teste de Plano

1. Acesse `/planos`
2. Selecione um plano (Bronze, Prata ou Ouro)
3. Marque o checkbox de aceite dos termos
4. Clique em "Assinar este plano"
5. Preencha os dados na página de pagamento
6. Será redirecionado para o Asaas

### 3. Teste de Agendamento

1. Acesse `/agendamento`
2. Selecione serviços, beats, data e horário
3. Clique em "Confirmar agendamento e ir para pagamentos"
4. Preencha os dados na página de pagamento
5. Será redirecionado para o Asaas

## 📝 Webhooks (Importante!)

O Asaas precisa notificar seu sistema quando um pagamento for confirmado. Você precisa configurar o webhook:

### 1. Criar Rota de Webhook

A rota já está preparada em: `/api/webhooks/asaas/route.ts` (você pode precisar criar este arquivo)

### 2. Configurar no Painel do Asaas

1. Acesse o painel do Asaas
2. Vá em **"Integrações"** → **"Webhooks"**
3. Adicione a URL: `https://seu-dominio.com/api/webhooks/asaas`
4. Selecione os eventos:
   - `PAYMENT_CREATED` - Pagamento criado
   - `PAYMENT_RECEIVED` - Pagamento confirmado ✅
   - `PAYMENT_OVERDUE` - Pagamento vencido
   - `PAYMENT_DELETED` - Pagamento deletado

### 3. Para Desenvolvimento Local

Use uma ferramenta como **ngrok** para expor seu localhost:

```bash
# Instalar ngrok
npm install -g ngrok

# Expor porta 3000
ngrok http 3000

# Use a URL gerada (ex: https://abc123.ngrok.io/api/webhooks/asaas)
```

## 🔍 Verificar Status

Para verificar qual provedor está sendo usado:

1. Acesse: `http://localhost:3000/api/payment-provider`
2. Você verá:
```json
{
  "provider": "asaas",
  "available": {
    "asaas": true,
    "infinitypay": false,
    "mercadopago": false
  }
}
```

## ⚠️ Troubleshooting

### Erro: "ASAAS_API_KEY não configurado"

- Verifique se a variável está no arquivo `.env`
- Reinicie o servidor após adicionar a variável
- Verifique se não há espaços extras no token

### Erro: "Asaas API error: 401"

- Token inválido ou expirado
- Verifique se está usando o token correto (sandbox vs produção)
- Gere um novo token no painel do Asaas

### Erro: "Asaas não retornou URL de checkout"

- Verifique os logs do console para ver a resposta completa
- Pode ser um problema na estrutura do payload
- Verifique a documentação do Asaas para mudanças na API

### Pagamento não está sendo confirmado

- Verifique se o webhook está configurado corretamente
- Verifique os logs do webhook no painel do Asaas
- Teste o webhook manualmente usando a ferramenta de teste do Asaas

## 📚 Recursos Adicionais

- **Documentação Oficial**: https://docs.asaas.com/
- **Painel do Asaas**: https://www.asaas.com/
- **Sandbox**: https://sandbox.asaas.com/
- **Suporte**: suporte@asaas.com

## ✅ Checklist de Configuração

- [ ] Conta criada no Asaas (sandbox para testes)
- [ ] API Key gerada e copiada
- [ ] `ASAAS_API_KEY` configurado no `.env`
- [ ] Servidor reiniciado
- [ ] Teste de pagamento realizado (box de teste admin)
- [ ] Webhook configurado no painel do Asaas
- [ ] Teste de webhook realizado
- [ ] Fluxo completo testado (plano e agendamento)

## 🎯 Próximos Passos

1. **Testar em sandbox** - Use o ambiente de teste primeiro
2. **Configurar webhook** - Essencial para confirmar pagamentos
3. **Testar fluxo completo** - Do checkout até a confirmação
4. **Migrar para produção** - Quando tudo estiver funcionando
5. **Monitorar pagamentos** - Acompanhe no painel do Asaas

---

**Nota**: O Asaas é especialmente bom para **assinaturas recorrentes** (planos mensais/anuais). Se você tiver planos recorrentes, considere usar a funcionalidade de **Assinaturas** do Asaas em vez de criar pagamentos únicos.
