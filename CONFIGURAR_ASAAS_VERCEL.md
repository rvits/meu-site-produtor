# 🔧 Configurar ASAAS_API_KEY no Vercel

## ⚠️ Problema

O erro "Configuração de pagamento ausente no servidor" aparece porque a variável `ASAAS_API_KEY` não está configurada no Vercel (produção).

---

## ✅ Solução: Adicionar Variável no Vercel

### Passo 1: Obter a API Key do Asaas

1. **Acesse o painel do Asaas:**
   - Produção: https://www.asaas.com/
   - Sandbox (testes): https://sandbox.asaas.com/

2. **Faça login** na sua conta

3. **Vá em "Integrações"** ou **"API"** no menu lateral

4. **Clique em "Criar Token de Acesso"** ou **"API Key"**

5. **Copie o token** gerado
   - Formato: `$aact_YTU5YTE0M2M2N2I4MTIxNzliZDkxYWE5Y2I2NDRjMDM6OjAwMDAwMDAwMDAwMDAwNzU3NDY6OiRhYWNoXzE4YzM0NDNhLWE3YjEtNDY5ZC05YjM5LWM5ZDFhNzI4YjFjYw==`
   - **IMPORTANTE**: Guarde este token com segurança!

---

### Passo 2: Adicionar no Vercel

1. **Acesse:** https://vercel.com/dashboard

2. **Selecione seu projeto** (meu-site-produtor)

3. **Vá em "Settings"** (Configurações)

4. **Clique em "Environment Variables"** (Variáveis de Ambiente)

5. **Adicione a variável:**
   - **Name (Nome):** `ASAAS_API_KEY`
   - **Value (Valor):** Cole o token que você copiou do Asaas
   - **Environments (Ambientes):** Marque **Production**, **Preview** e **Development**

6. **Clique em "Save"** (Salvar)

---

### Passo 3: Fazer Redeploy

Após adicionar a variável, você precisa fazer um novo deploy:

1. **No Vercel Dashboard**, vá em **"Deployments"**

2. **Clique nos 3 pontos** do último deploy

3. **Clique em "Redeploy"**

   **OU**

   Faça um novo commit e push:

   ```bash
   git commit --allow-empty -m "Redeploy: configurar ASAAS_API_KEY"
   git push origin main
   ```

---

## 🔍 Verificar se Funcionou

1. **Aguarde o deploy concluir** (2-3 minutos)

2. **Tente fazer um pagamento novamente**

3. **O erro não deve mais aparecer**

---

## ⚠️ Importante

- **Token de Produção vs Sandbox:**
  - Se usar token de **produção**: pagamentos reais serão processados
  - Se usar token de **sandbox**: apenas testes (sem cobrança real)

- **Segurança:**
  - Nunca compartilhe sua API Key
  - Não commite o token no Git
  - Use apenas no Vercel Environment Variables

---

## 📝 Se Ainda Não Funcionar

1. **Verifique se o token está correto:**
   - Deve começar com `$aact_`
   - Deve ter pelo menos 100 caracteres

2. **Verifique se o redeploy foi concluído:**
   - Vá em Deployments no Vercel
   - Veja se o último deploy está "Ready"

3. **Verifique os logs:**
   - No Vercel, vá em Deployments
   - Clique no último deploy
   - Veja os logs para erros

---

**Após configurar, aguarde o redeploy e teste novamente!**
