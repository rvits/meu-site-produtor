# 💻 Como Abrir um Novo Terminal no Windows

## 🎯 Por que precisa de dois terminais?

- **Terminal 1:** Roda o servidor Next.js (`npm run dev`) - **NÃO FECHE ESTE!**
- **Terminal 2:** Roda o ngrok (`ngrok http 3000`) - **NOVO TERMINAL**

## 📝 Passo a Passo

### Opção 1: Abrir Novo Terminal no VS Code / Cursor

1. **No VS Code ou Cursor:**
   - Pressione **`Ctrl + Shift + ``** (Ctrl + Shift + crase/backtick)
   - OU vá em **Terminal** → **New Terminal** (no menu superior)
   - OU clique no ícone **`+`** ao lado da aba do terminal atual

2. **Você verá uma nova aba de terminal aberta**

3. **No novo terminal, execute:**
   ```bash
   ngrok http 3000
   ```

### Opção 2: Abrir Novo PowerShell/CMD Separado

1. **Pressione `Windows + R`** (ou clique no menu Iniciar)

2. **Digite:**
   ```
   powershell
   ```
   OU
   ```
   cmd
   ```

3. **Pressione Enter**

4. **Navegue até a pasta do projeto:**
   ```powershell
   cd C:\Users\raulv\Documents\projetos\meu-site-produtor
   ```

5. **Execute o ngrok:**
   ```bash
   ngrok http 3000
   ```

### Opção 3: Abrir Diretamente na Pasta do Projeto

1. **Abra o Explorador de Arquivos do Windows**

2. **Navegue até:**
   ```
   C:\Users\raulv\Documents\projetos\meu-site-produtor
   ```

3. **Clique com o botão direito na pasta**

4. **Selecione:**
   - **"Abrir no Terminal"** ou
   - **"Abrir janela do PowerShell aqui"**

5. **Execute:**
   ```bash
   ngrok http 3000
   ```

## ✅ Como Ficará

Você terá **2 terminais abertos**:

**Terminal 1 (servidor Next.js):**
```
PS C:\Users\raulv\Documents\projetos\meu-site-produtor> npm run dev
> meu-site-produtor@0.1.0 dev
> next dev -H 0.0.0.0
▲ Next.js 16.0.7
✓ Ready in 3.4s
```

**Terminal 2 (ngrok):**
```
PS C:\Users\raulv\Documents\projetos\meu-site-produtor> ngrok http 3000

ngrok                                                                        

Session Status                online
Account                       seu-email@example.com
Forwarding                    https://abc123xyz.ngrok.io -> http://localhost:3000
```

## 🎯 Resumo

- **Terminal 1:** Deixe rodando `npm run dev` (NÃO FECHE!)
- **Terminal 2:** Execute `ngrok http 3000` (NOVO TERMINAL)
- **Copie a URL HTTPS** do ngrok
- **Use no formulário do Asaas:** `https://SUA-URL-NGROK.ngrok.io/api/webhooks/asaas`

## 💡 Dica

Se você estiver usando **VS Code** ou **Cursor**, a forma mais fácil é:
- Pressionar **`Ctrl + Shift + ``** para abrir um novo terminal na mesma janela
