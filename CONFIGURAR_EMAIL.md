# 📧 Configuração de Email para Recuperação de Senha

Para que o sistema de recuperação de senha funcione e envie emails automaticamente, você precisa configurar as credenciais do Gmail.

## ⚠️ IMPORTANTE: Senha de App do Google

**NÃO use a senha normal da sua conta Gmail!** O Google não permite mais usar senhas normais para aplicações de terceiros. Você precisa criar uma **"Senha de App"** específica.

## 📋 Passo a Passo para Configurar

### 1. Ativar Verificação em Duas Etapas

Primeiro, você precisa ter a verificação em duas etapas ativada na sua conta Google:

1. Acesse: https://myaccount.google.com/security
2. Procure por "Verificação em duas etapas"
3. Se não estiver ativada, ative-a (é obrigatório para criar Senhas de App)

### 2. Criar Senha de App

1. Acesse: https://myaccount.google.com/apppasswords
   - Ou vá em: Conta Google → Segurança → Verificação em duas etapas → Senhas de app
2. Selecione "App" → escolha "Email"
3. Selecione "Dispositivo" → escolha "Outro (nome personalizado)"
4. Digite: "THouse Rec Site"
5. Clique em "Gerar"
6. **COPIE A SENHA GERADA** (ela aparece apenas uma vez!)
   - Será algo como: `abcd efgh ijkl mnop` (16 caracteres com espaços)

### 3. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
SUPPORT_EMAIL=thouse.rec.tremv@gmail.com
SUPPORT_EMAIL_PASSWORD=abcdefghijklmnop
SUPPORT_DEST_EMAIL=tremv03021@gmail.com
```

**Importante:**
- `SUPPORT_EMAIL`: O email que vai ENVIAR os emails (thouse.rec.tremv@gmail.com)
- `SUPPORT_EMAIL_PASSWORD`: A **Senha de App** gerada (sem espaços!)
- `SUPPORT_DEST_EMAIL`: Email que recebe notificações de suporte (opcional)

### 4. Remover Espaços da Senha de App

A senha gerada pelo Google vem com espaços. **Remova todos os espaços** antes de colocar no `.env`:

- ❌ Errado: `abcd efgh ijkl mnop`
- ✅ Correto: `abcdefghijklmnop`

### 5. Reiniciar o Servidor

Após configurar o `.env`, reinicie o servidor de desenvolvimento:

```bash
# Pare o servidor (Ctrl+C) e inicie novamente
npm run dev
```

## ✅ Testar o Envio de Email

1. Acesse: http://localhost:3000/esqueci-senha
2. Digite um email válido cadastrado no sistema
3. Clique em "Enviar Código"
4. Verifique a caixa de entrada do email digitado
5. Verifique também a pasta de **Spam/Lixo Eletrônico**

## 🔍 Verificar se Está Funcionando

Se o email não estiver configurado, você verá no console do servidor:

```
📧 Email de suporte NÃO configurado.
Código de recuperação para email@exemplo.com : 123456
```

Se estiver configurado corretamente, o email será enviado automaticamente.

## ❌ Problemas Comuns

### "Invalid login" ou "Authentication failed"

- Verifique se removeu os espaços da Senha de App
- Certifique-se de que está usando a Senha de App, não a senha normal
- Verifique se a verificação em duas etapas está ativada

### Email não chega

- Verifique a pasta de Spam
- Verifique se o email digitado está correto
- Verifique os logs do servidor para erros

### "Less secure app access"

- Não é mais necessário ativar "Acesso a apps menos seguros"
- Use apenas a Senha de App

## 📝 Nota de Segurança

- **NUNCA** commite o arquivo `.env` no Git
- A Senha de App é específica para esta aplicação
- Você pode revogar a Senha de App a qualquer momento em: https://myaccount.google.com/apppasswords

---

**Status:** ✅ Configuração necessária para funcionar
**Email configurado:** thouse.rec.tremv@gmail.com
