# 🚀 Resolver ngrok AGORA - Passo a Passo Simples

## ⚡ Solução Rápida

Execute estes comandos **um por vez** no PowerShell:

### 1️⃣ Matar qualquer processo do ngrok
```powershell
taskkill /F /IM ngrok.exe
```

### 2️⃣ Aguardar 2 segundos
```powershell
Start-Sleep -Seconds 2
```

### 3️⃣ Iniciar o ngrok
```powershell
ngrok http 3000
```

---

## ✅ Se Funcionou

Você verá algo assim no terminal:
```
ngrok                                                                               

Session Status                online
Account                       seu-email@exemplo.com
Version                       3.x.x
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123xyz.ngrok.io -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Copie a URL HTTPS** (ex: `https://abc123xyz.ngrok.io`) e use no Asaas:
```
https://abc123xyz.ngrok.io/api/webhooks/asaas
```

---

## ❌ Se Ainda Não Funcionar

### Opção 1: Reiniciar o Computador
- Reinicie o PC
- Depois execute `ngrok http 3000` novamente

### Opção 2: Usar LocalTunnel (Alternativa)
```powershell
npm install -g localtunnel
lt --port 3000
```

### Opção 3: Verificar se há outro terminal com ngrok
- Feche **TODOS** os terminais abertos
- Abra um **NOVO** terminal
- Execute `ngrok http 3000`

---

## 📋 Checklist

- [ ] Executei `taskkill /F /IM ngrok.exe`
- [ ] Aguardei alguns segundos
- [ ] Executei `ngrok http 3000` em um terminal NOVO
- [ ] O ngrok iniciou e mostrou uma URL HTTPS
- [ ] Copiei a URL e adicionei `/api/webhooks/asaas` no final
- [ ] Configurei no Asaas

---

## 🎯 URL Final para o Asaas

Quando o ngrok mostrar a URL, use assim:
```
https://SUA-URL-NGROK.ngrok.io/api/webhooks/asaas
```

**Exemplo:**
Se o ngrok mostrar `https://abc123xyz.ngrok.io`, use:
```
https://abc123xyz.ngrok.io/api/webhooks/asaas
```
