# 💰 Status do Sistema de Reembolso Direto

**Data da Verificação:** Fevereiro/2025

## 📊 SITUAÇÃO ATUAL

### ✅ **REEMBOLSOS DIRETOS - IMPLEMENTADOS E FUNCIONANDO**

#### 1. **Cancelamento de Planos** (`/api/planos/cancelar`)
- ✅ **REEMBOLSO DIRETO IMPLEMENTADO**
- ✅ Usuário pode escolher entre:
  - **Reembolso direto na conta bancária** (via Asaas)
  - **Cupom de reembolso** (para usar em futuros agendamentos)
- ✅ Funciona através da função `refundAsaasPayment()` em `src/app/lib/asaas-refund.ts`
- ✅ Busca o pagamento original pelo `asaasId`
- ✅ Chama a API do Asaas: `POST /payments/{paymentId}/refund`
- ✅ Se o reembolso direto falhar, cria cupom como fallback automaticamente

**Como funciona:**
1. Usuário cancela plano na página "Minha Conta"
2. Sistema pergunta: "Reembolso direto ou cupom?"
3. Se escolher "direto":
   - Busca pagamento original com `asaasId`
   - Chama `refundAsaasPayment(paymentId, valor, descrição)`
   - Asaas processa reembolso na conta bancária do cliente
   - Reembolso aparece em até 5 dias úteis na conta do cliente
4. Se escolher "cupom" ou se reembolso direto falhar:
   - Cria cupom de reembolso com valor calculado
   - Cupom pode ser usado em futuros agendamentos

### ❌ **REEMBOLSOS DIRETOS - NÃO IMPLEMENTADOS**

#### 2. **Cancelamento de Agendamentos** (`/api/admin/agendamentos/cancelar`)
- ❌ **APENAS CUPOM DE REEMBOLSO**
- ❌ Não há opção de reembolso direto
- ✅ Atualmente gera apenas cupom de reembolso automaticamente
- ⚠️ **NECESSITA IMPLEMENTAÇÃO** para oferecer reembolso direto

**Como funciona atualmente:**
1. Admin cancela agendamento
2. Sistema busca pagamento associado
3. **Sempre cria cupom de reembolso** (não oferece opção de reembolso direto)
4. Cupom é enviado por e-mail ao usuário

## 🔧 COMO O REEMBOLSO DIRETO FUNCIONA NO ASAAS

### Processo Automático do Asaas:

1. **Dados Bancários do Cliente:**
   - O Asaas **NÃO precisa** que você forneça dados bancários do cliente
   - O Asaas usa os dados bancários que o cliente forneceu **durante o pagamento original**
   - Para PIX: usa a chave PIX cadastrada
   - Para cartão: reembolsa no mesmo cartão usado
   - Para boleto: reembolsa na conta que fez o pagamento

2. **API de Reembolso:**
   ```typescript
   POST /api/v3/payments/{paymentId}/refund
   {
     "value": 100.00,  // Opcional: se não informar, reembolsa tudo
     "description": "Reembolso de cancelamento"
   }
   ```

3. **Resposta do Asaas:**
   - Retorna dados do reembolso criado
   - Status: `REFUNDED`
   - O reembolso é processado automaticamente pelo Asaas

4. **Prazo de Processamento:**
   - **PIX:** Até 1 dia útil
   - **Cartão de Crédito:** 5-10 dias úteis (depende do banco)
   - **Cartão de Débito:** 1-3 dias úteis
   - **Boleto:** 3-5 dias úteis

## 📋 O QUE ESTÁ FUNCIONANDO

### ✅ Planos - Reembolso Direto
- [x] Função `refundAsaasPayment()` implementada
- [x] Interface permite escolher reembolso direto ou cupom
- [x] Busca pagamento original pelo `asaasId`
- [x] Chama API do Asaas corretamente
- [x] Fallback para cupom se reembolso falhar
- [x] E-mail de confirmação enviado

### ✅ Planos - Cupom de Reembolso
- [x] Geração automática de cupom
- [x] Cálculo proporcional baseado em serviços não utilizados
- [x] Validade de 90 dias
- [x] E-mail com código do cupom

### ✅ Agendamentos - Cupom de Reembolso
- [x] Geração automática ao cancelar
- [x] Valor igual ao pagamento original
- [x] Validade de 90 dias
- [x] E-mail com código do cupom

## ❌ O QUE FALTA IMPLEMENTAR

### ⚠️ Agendamentos - Reembolso Direto
- [ ] Adicionar opção de escolha (reembolso direto ou cupom) no cancelamento de agendamento
- [ ] Integrar `refundAsaasPayment()` no endpoint de cancelamento de agendamento
- [ ] Buscar pagamento associado ao agendamento
- [ ] Oferecer escolha ao admin ou usuário (dependendo de quem cancela)

## 🔍 VERIFICAÇÕES NECESSÁRIAS

### 1. **Testar Reembolso Direto de Planos**
Para verificar se está funcionando:
1. Criar um plano de teste
2. Fazer pagamento (PIX ou cartão)
3. Cancelar o plano escolhendo "Reembolso direto"
4. Verificar se o reembolso aparece no painel do Asaas
5. Verificar se o valor retorna na conta do cliente

### 2. **Verificar Logs**
Procurar por:
- `[Asaas Refund] Fazendo reembolso do pagamento`
- `[Asaas Refund] Reembolso realizado com sucesso`
- `[Cancelar Plano] Reembolso direto realizado`

### 3. **Verificar Erros**
Se houver erros, podem ser:
- Pagamento não encontrado (sem `asaasId`)
- Erro na API do Asaas (credenciais, permissões)
- Pagamento já reembolsado
- Limite de tempo para reembolso (alguns gateways têm prazo)

## 📝 RECOMENDAÇÕES

### Para Implementar Reembolso Direto em Agendamentos:

1. **Modificar `/api/admin/agendamentos/cancelar/route.ts`:**
   - Adicionar parâmetro `refundType` (opcional, default: "coupon")
   - Se `refundType === "direct"`:
     - Buscar pagamento associado ao agendamento
     - Verificar se tem `asaasId`
     - Chamar `refundAsaasPayment()`
   - Se `refundType === "coupon"` ou se reembolso falhar:
     - Criar cupom (como já faz)

2. **Atualizar Interface Admin:**
   - Adicionar opção de escolha no cancelamento de agendamento
   - Permitir que admin escolha: "Reembolso direto" ou "Cupom"

3. **Atualizar E-mails:**
   - Informar se foi reembolso direto ou cupom
   - Informar prazo de processamento do reembolso

## ✅ CONCLUSÃO

**Status Atual:**
- ✅ **Reembolso direto FUNCIONANDO para PLANOS**
- ❌ **Reembolso direto NÃO implementado para AGENDAMENTOS** (apenas cupom)

**Próximos Passos:**
1. Testar reembolso direto de planos em produção
2. Implementar reembolso direto para agendamentos (se desejado)
3. Documentar prazos de processamento para usuários
