# 📱 Como Acessar o Site no Celular pelo Localhost

## 🖥️ Passo 1: Iniciar o Servidor

No terminal, na pasta do projeto, execute:

```bash
npm run dev
```

O servidor vai iniciar e você verá algo como:
```
  ▲ Next.js 16.0.7
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

## 📱 Passo 2: Descobrir o IP Local do Seu Computador

### **Windows:**

1. Abra o **Prompt de Comando** (cmd) ou **PowerShell**
2. Digite:
   ```bash
   ipconfig
   ```
3. Procure por **"IPv4 Address"** ou **"Endereço IPv4"** na seção do seu adaptador WiFi
4. Você verá algo como: `192.168.1.100` ou `192.168.0.50`

### **Mac/Linux:**

1. Abra o **Terminal**
2. Digite:
   ```bash
   ifconfig
   ```
   ou
   ```bash
   ip addr show
   ```
3. Procure por `inet` na seção `wlan0` ou `en0`
4. Você verá algo como: `192.168.1.100`

## 🔧 Passo 3: Configurar o Next.js para Aceitar Conexões Externas

Por padrão, o Next.js só aceita conexões de `localhost`. Para permitir acesso do celular, você precisa iniciar o servidor com o IP `0.0.0.0`.

### **Opção A: Modificar o script (Recomendado)**

Vou atualizar o `package.json` para você. Mas se quiser fazer manualmente:

Edite o arquivo `package.json` e mude:
```json
"dev": "next dev"
```

Para:
```json
"dev": "next dev -H 0.0.0.0"
```

### **Opção B: Rodar direto no terminal**

```bash
npx next dev -H 0.0.0.0
```

## 📱 Passo 4: Acessar no Celular

1. **Certifique-se de que o celular está na mesma rede WiFi** que o computador
2. No navegador do celular, acesse:
   ```
   http://SEU_IP:3000
   ```
   
   Exemplo:
   ```
   http://192.168.1.100:3000
   ```

## ✅ Checklist

- [ ] Servidor rodando (`npm run dev`)
- [ ] Servidor configurado com `-H 0.0.0.0`
- [ ] IP local descoberto (ex: `192.168.1.100`)
- [ ] Celular na mesma rede WiFi
- [ ] Acessando `http://SEU_IP:3000` no celular

## 🔥 Dica Rápida

Se você quiser, posso atualizar o `package.json` para sempre iniciar com `-H 0.0.0.0`, assim você não precisa se preocupar com isso toda vez!

## ⚠️ Problemas Comuns

### "Não consigo acessar"
- Verifique se o celular está na mesma rede WiFi
- Verifique se o firewall do Windows/Mac não está bloqueando a porta 3000
- Tente desativar temporariamente o firewall para testar

### "Página não carrega"
- Verifique se o servidor está rodando
- Verifique se você digitou o IP correto
- Tente acessar `http://localhost:3000` no computador primeiro para confirmar que está funcionando

### "Firewall bloqueando"
**Windows:**
1. Vá em "Configurações" → "Firewall do Windows Defender"
2. Clique em "Permitir um aplicativo pelo Firewall"
3. Adicione Node.js ou a porta 3000

**Mac:**
1. Vá em "Preferências do Sistema" → "Segurança e Privacidade" → "Firewall"
2. Clique em "Opções do Firewall"
3. Adicione Node.js às exceções

---

**Pronto!** Agora você pode testar o site responsivo diretamente no seu celular! 📱✨
