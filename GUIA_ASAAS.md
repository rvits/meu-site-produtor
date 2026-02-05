# 🚀 Guia Rápido: Configurar Asaas

## ✅ O que foi implementado

1. ✅ Classe `AsaasProvider` - Integração completa com API do Asaas
2. ✅ Rotas de API:
   - `/api/asaas/checkout` - Para planos
   - `/api/asaas/checkout-agendamento` - Para agendamentos
   - `/api/webhooks/asaas` - Para receber notificações
3. ✅ Detecção automática de provedor (Asaas tem prioridade)
4. ✅ Suporte a sandbox (ambiente de teste)
5. ✅ Box de teste para admin (R$ 5,00)
6. ✅ Schema do Prisma atualizado (campo `asaasId`)

## 📝 Passo a Passo para Configurar

### 1️⃣ Criar Conta no Asaas

1. Acesse: **https://www.asaas.com/**
2. Clique em **"Criar Conta"** ou **"Começar Grátis"**
3. Preencha seus dados (pode usar CPF ou CNPJ)
4. Complete o cadastro e verifique seu email

### 2️⃣ Obter API Key (Token) com Permissões Corretas

⚠️ **ATENÇÃO**: É **ESSENCIAL** que o token tenha a permissão de **ESCRITA (WRITE)** para criar pagamentos!

#### 📋 Passo a Passo Detalhado:

1. **Faça login no painel do Asaas**
   - Acesse: https://www.asaas.com/
   - Entre com suas credenciais

2. **Acesse a seção de API**
   - No menu lateral, clique em **"Integrações"**
   - Depois clique em **"API"** ou **"Tokens de Acesso"**

3. **Criar um novo token**
   - Clique em **"Criar Token de Acesso"** ou **"Novo Token"**
   - Dê um nome descritivo (ex: "THouse Rec - Produção")

4. **⚠️ CONFIGURAR PERMISSÕES (MUITO IMPORTANTE!)**

   O Asaas mostra opções de permissão para cada recurso. Você DEVE escolher:

   **Para PAGAMENTOS (PAYMENT):**
   - ❌ **NENHUM** - NÃO escolha (não permite criar pagamentos)
   - ❌ **READ** - NÃO escolha (só permite ler, não criar)
   - ✅ **WRITE** - **ESCOLHA ESTA!** (permite criar e gerenciar pagamentos)

   **Para CLIENTES (CUSTOMER) - Recomendado:**
   - ✅ **WRITE** - Recomendado (permite criar clientes automaticamente)
   - ✅ **READ** - Recomendado (permite consultar clientes)

   **Resumo das permissões necessárias:**
   ```
   ✅ PAYMENT: WRITE (OBRIGATÓRIO)
   ✅ PAYMENT: READ (Recomendado)
   ✅ CUSTOMER: WRITE (Recomendado)
   ✅ CUSTOMER: READ (Recomendado)
   ```

5. **Salvar e copiar o token**
   - Clique em **"Criar"** ou **"Salvar"**
   - **COPIE O TOKEN IMEDIATAMENTE** (formato: `$aact_prod_...` para produção)
   - ⚠️ **IMPORTANTE**: O token só é mostrado UMA VEZ! Guarde em local seguro!

6. **Verificar o ambiente**
   - Se o token começa com `$aact_prod_` → É de **PRODUÇÃO**
   - Se o token começa com `$aact_YTU...` ou outros → É de **SANDBOX** (teste)

#### 🔍 Como Verificar se o Token Tem as Permissões Corretas

Se você receber o erro:
```
insufficient_permission: A chave de API fornecida não tem as permissões necessárias. 
Verifique se a chave possui o escopo PAYMENT:WRITE
```

Isso significa que o token atual **não tem a permissão PAYMENT:WRITE**. 

#### ✅ Solução: Criar um Novo Token com Permissões Corretas

1. **Acesse o painel do Asaas**
   - Vá em **Integrações** → **API** → **Tokens de Acesso**

2. **Revogar o token antigo (opcional, mas recomendado)**
   - Encontre o token atual na lista
   - Clique em **"Revogar"** ou **"Excluir"**
   - Isso garante que tokens antigos não sejam usados acidentalmente

3. **Criar um novo token**
   - Clique em **"Criar Token de Acesso"**
   - Dê um nome (ex: "THouse Rec - Produção - Correto")
   - **Na seção de PAGAMENTOS, escolha: WRITE** (não "Nenhum" nem "Read")
   - **Na seção de CLIENTES, escolha: WRITE** (recomendado)
   - Clique em **"Criar"**

4. **Copiar o novo token**
   - ⚠️ **COPIE IMEDIATAMENTE** - ele só aparece uma vez!
   - Formato: `$aact_prod_...` (produção) ou `$aact_YTU...` (sandbox)

5. **Atualizar no projeto**
   - Abra o arquivo `.env` ou `.env.local`
   - Substitua a linha:
     ```env
     ASAAS_API_KEY=$aact_prod_SEU_NOVO_TOKEN_AQUI
     ```
   - Salve o arquivo

6. **Reiniciar o servidor**
   ```bash
   # Pare o servidor (Ctrl+C)
   npm run dev
   ```

7. **Testar novamente**
   - Acesse `/agendamento` ou `/planos`
   - Clique em "Testar Pagamento - R$ 5,00"
   - Deve funcionar agora! ✅

### 3️⃣ Configurar Webhook (IMPORTANTE!)

⚠️ **O Webhook é essencial para receber notificações quando os pagamentos forem confirmados!**

1. **Acesse a seção Webhooks no Asaas**
   - Vá em **Integrações** → **Webhooks**
   - Clique em **"Adicionar Webhook"**

2. **Configure o Webhook:**
   - **URL do Webhook:**
     - Desenvolvimento (com ngrok): `https://seu-ngrok.ngrok.io/api/webhooks/asaas`
     - Produção: `https://seudominio.com/api/webhooks/asaas`
   - **Eventos:** Selecione pelo menos **PAYMENT_RECEIVED**
   - **Token (Opcional):** Pode deixar vazio

3. **Salvar o Webhook**

📖 **Guia detalhado:** Veja o arquivo `CONFIGURAR_WEBHOOK_ASAAS.md`

### 4️⃣ Configurar no Projeto

1. Abra o arquivo `.env` na raiz do projeto
2. Adicione a linha:
   ```env
   ASAAS_API_KEY=$aact_SEU_TOKEN_AQUI
   ```
3. **Substitua** `$aact_SEU_TOKEN_AQUI` pelo token que você copiou
4. Salve o arquivo

### 5️⃣ Atualizar Banco de Dados

Execute o comando para adicionar o campo `asaasId`:

```bash
npx prisma db push
```

Ou se preferir criar uma migration:

```bash
npx prisma migrate dev --name add_asaas_id
```

### 6️⃣ Reiniciar o Servidor

```bash
# Pare o servidor (Ctrl+C) e inicie novamente
npm run dev
```

## 🧪 Testar

> ⚠️ **IMPORTANTE**: Antes de testar, certifique-se de que o Webhook está configurado! Sem o webhook, os pagamentos serão criados, mas o sistema não saberá quando foram confirmados.

### Teste Rápido (Admin)

1. Faça login como admin (`thouse.rec.tremv@gmail.com`)
2. Acesse `/planos` ou `/agendamento`
3. Você verá uma **box amarela** com "🧪 Pagamento de Teste"
4. Clique em **"Testar Pagamento - R$ 5,00"**
5. Será redirecionado para o Asaas
6. Complete o pagamento de teste

### Teste Completo

1. Acesse `/planos`
2. Selecione um plano
3. Marque o checkbox de termos
4. Clique em "Assinar este plano"
5. Preencha os dados
6. Será redirecionado para o Asaas
7. Escolha a forma de pagamento (Pix, Cartão, etc.)

## 🔔 Configurar Webhook (Importante!)

O webhook é necessário para o sistema saber quando um pagamento foi confirmado.

### Opção 1: Produção (quando estiver em produção)

1. Acesse o painel do Asaas
2. Vá em **"Integrações"** → **"Webhooks"**
3. Adicione a URL: `https://seu-dominio.com/api/webhooks/asaas`
4. Selecione os eventos:
   - ✅ `PAYMENT_RECEIVED` (essencial)
   - `PAYMENT_CREATED`
   - `PAYMENT_OVERDUE`

### Opção 2: Desenvolvimento Local (usando ngrok)

1. Instale o ngrok:
   ```bash
   npm install -g ngrok
   ```

2. Exponha seu localhost:
   ```bash
   ngrok http 3000
   ```

3. Copie a URL gerada (ex: `https://abc123.ngrok.io`)

4. No painel do Asaas, configure o webhook:
   - URL: `https://abc123.ngrok.io/api/webhooks/asaas`
   - Eventos: `PAYMENT_RECEIVED`

## 🎯 Verificar se Está Funcionando

Acesse: `http://localhost:3000/api/payment-provider`

Você deve ver:
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

## ⚠️ Problemas Comuns

### "ASAAS_API_KEY não configurado"
- ✅ Verifique se adicionou no `.env`
- ✅ Reinicie o servidor
- ✅ Verifique se não há espaços extras no token

### "Asaas API error: 401"
- ✅ Token inválido ou expirado
- ✅ Gere um novo token no painel do Asaas
- ✅ Verifique se está usando o token correto (sandbox vs produção)

### Pagamento não confirma
- ✅ Configure o webhook (veja seção acima)
- ✅ Verifique os logs do console
- ✅ Teste o webhook no painel do Asaas

## 📚 Recursos

- **Documentação**: https://docs.asaas.com/
- **Painel**: https://www.asaas.com/
- **Sandbox**: https://sandbox.asaas.com/ (para testes)

## ✅ Checklist Final

- [ ] Conta criada no Asaas
- [ ] API Key gerada e copiada
- [ ] `ASAAS_API_KEY` adicionado no `.env`
- [ ] Banco de dados atualizado (`npx prisma db push`)
- [ ] Servidor reiniciado
- [ ] Teste de pagamento realizado (box admin)
- [ ] Webhook configurado
- [ ] Fluxo completo testado

---

**Pronto!** 🎉 O Asaas está configurado e pronto para uso. O sistema automaticamente usará o Asaas quando a `ASAAS_API_KEY` estiver configurada.
