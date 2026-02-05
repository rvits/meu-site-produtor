# 🔑 Como Obter a Senha do LocalTunnel

## ⚠️ Problema

O LocalTunnel está pedindo uma senha para acessar o site. Essa senha é o **IP público** do seu computador.

## 📋 Solução Rápida

### Opção 1: Usar o Comando do LocalTunnel

O próprio LocalTunnel fornece um link para obter a senha. Execute este comando no terminal onde o LocalTunnel está rodando:

```powershell
# No terminal onde o LocalTunnel está rodando, você verá uma mensagem com um link
# Ou acesse diretamente:
start https://loca.lt/mytunnelpassword
```

### Opção 2: Obter IP Público Manualmente

1. **Abra um novo terminal PowerShell**
2. **Execute este comando**:
   ```powershell
   Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' | Select-Object -ExpandProperty ip
   ```
3. **Copie o IP que aparecer** (exemplo: `191.123.45.67`)
4. **Cole no campo "Tunnel Password"** da página do LocalTunnel

### Opção 3: Usar ngrok (Recomendado - Não pede senha)

Se preferir evitar essa tela de senha, use **ngrok** em vez de LocalTunnel:

1. **Pare o LocalTunnel** (Ctrl+C no terminal onde está rodando)
2. **Execute ngrok**:
   ```powershell
   ngrok http 3000
   ```
3. **Copie a URL HTTPS gerada** (exemplo: `https://xxxxx.ngrok.io`)
4. **Atualize o `.env`**:
   ```
   NEXT_PUBLIC_SITE_URL=https://xxxxx.ngrok.io
   ```
5. **Atualize o campo "Site" no Asaas** com a nova URL
6. **Reinicie o servidor Next.js**

## ✅ Após Obter a Senha

1. **Cole o IP público** no campo "Tunnel Password"
2. **Clique em "Click to Submit"**
3. **Você será redirecionado** para a página de confirmação de pagamento

## 🔄 Alternativa: Bypass da Página de Senha

Se você é o desenvolvedor, pode configurar o LocalTunnel para não mostrar essa página adicionando um header especial. Mas isso requer modificações no código do Asaas para enviar headers customizados, o que pode ser complicado.

**Recomendação**: Use **ngrok** que não tem essa limitação e é mais simples para desenvolvimento.
