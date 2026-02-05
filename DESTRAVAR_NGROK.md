# 🔧 Como Destravar o ngrok

## ❌ Problema
```
Falha na execução do programa 'ngrok.exe': O arquivo já está sendo usado por outro processo
```

Isso significa que há um processo do ngrok rodando em algum lugar.

## ✅ Solução Passo a Passo

### 1️⃣ Encontrar e Matar o Processo

**Opção A: Via PowerShell (Recomendado)**
```powershell
# Ver processos do ngrok
Get-Process ngrok -ErrorAction SilentlyContinue

# Matar todos os processos do ngrok
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Opção B: Via CMD**
```cmd
# Ver processos
tasklist | findstr ngrok

# Matar processo (substitua PID pelo número que aparecer)
taskkill /F /PID [PID]
```

**Opção C: Matar todos de uma vez**
```cmd
taskkill /F /IM ngrok.exe
```

### 2️⃣ Verificar se Fechou

```powershell
Get-Process ngrok -ErrorAction SilentlyContinue
```

Se não aparecer nada, o processo foi encerrado com sucesso!

### 3️⃣ Aguardar Alguns Segundos

```powershell
Start-Sleep -Seconds 3
```

### 4️⃣ Iniciar o ngrok Novamente

```powershell
ngrok http 3000
```

## 🎯 Comandos Rápidos (Copie e Cole)

**Em um terminal PowerShell, execute:**

```powershell
# Matar todos os processos do ngrok
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

# Aguardar 3 segundos
Start-Sleep -Seconds 3

# Iniciar o ngrok
ngrok http 3000
```

## ⚠️ Se Ainda Não Funcionar

1. **Reinicie o computador** (solução mais garantida)
2. **OU use LocalTunnel** como alternativa:
   ```powershell
   npm install -g localtunnel
   lt --port 3000
   ```

## 📝 Depois que o ngrok Iniciar

Você verá algo assim:
```
Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000
```

Copie a URL HTTPS e use no formulário do Asaas:
```
https://abc123xyz.ngrok.io/api/webhooks/asaas
```
