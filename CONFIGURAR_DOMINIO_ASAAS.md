# 🔧 Como Configurar Domínio no Asaas

## ⚠️ Erro Encontrado

```
Não há nenhum domínio configurado em sua conta. 
Cadastre um site em Minha Conta na aba Informações.
```

## 📋 Solução: Configurar Domínio no Painel do Asaas

### 🔍 Onde Encontrar a Configuração de Domínios

**IMPORTANTE:** A configuração de domínios NÃO está na seção "Integrações"!

Siga estes passos:

1. **No canto superior direito**, clique no seu **nome/perfil** ou no ícone de **menu** (☰)
2. Selecione **"Minha Conta"** ou **"Configurações"**
3. Procure por **"Informações"** ou **"Dados da Conta"**
4. Dentro dessa seção, procure por **"Domínios"** ou **"Sites"**
5. Se não encontrar, tente:
   - **"Configurações"** → **"Informações"** → **"Domínios"**
   - Ou procure por **"Checkout"** → pode ter uma opção de domínios lá

**Alternativa:** Se ainda não encontrar, o Asaas pode não permitir configurar domínios em contas sandbox/teste. Nesse caso, você precisará usar uma conta de produção ou criar uma conta sandbox separada.

### Para Desenvolvimento (Localhost)

O Asaas requer um domínio válido configurado. Para desenvolvimento local, você tem duas opções:

#### Opção 1: Usar LocalTunnel (Recomendado para testes)

1. **Instalar LocalTunnel** (se ainda não tiver):
   ```powershell
   npm install -g localtunnel
   ```

2. **Criar um túnel para a porta 3000**:
   ```powershell
   lt --port 3000
   ```

3. **Copiar a URL gerada** (exemplo: `https://xxxxx.loca.lt`)

4. **Configurar no Asaas**:
   - Acesse: https://www.asaas.com/
   - Faça login na sua conta
   - Vá em **Minha Conta** → **Informações**
   - Na seção **Domínios**, adicione o domínio do LocalTunnel (ex: `xxxxx.loca.lt`)
   - Salve as alterações

5. **Atualizar o código**:
   - Use a URL do LocalTunnel nas variáveis de ambiente ou no código

#### Opção 2: Usar ngrok (Alternativa)

1. **Instalar ngrok** (se ainda não tiver)
2. **Criar um túnel**:
   ```powershell
   ngrok http 3000
   ```
3. **Copiar a URL HTTPS gerada** (exemplo: `https://xxxxx.ngrok.io`)
4. **Configurar no Asaas** seguindo os mesmos passos da Opção 1

### Para Produção

1. **Acesse o painel do Asaas**: https://www.asaas.com/
2. **Faça login** na sua conta
3. **Vá em**: **Minha Conta** → **Informações**
4. **Na seção "Domínios"**, adicione seu domínio de produção (ex: `seusite.com.br`)
5. **Salve as alterações**

## 🔄 Após Configurar

1. Reinicie o servidor Next.js
2. Tente novamente o pagamento de teste

## 📝 Nota Importante

- O domínio precisa ser **HTTPS** (seguro)
- Para desenvolvimento, você pode usar LocalTunnel ou ngrok que fornecem URLs HTTPS gratuitas
- Em produção, use seu domínio real com certificado SSL

## 🆘 Problemas Comuns

### "Domínio não verificado"
- Aguarde alguns minutos após adicionar o domínio
- Verifique se o domínio está correto (sem `http://` ou `https://`, apenas o domínio)

### "Acesso negado"
- Verifique se você tem permissões de administrador na conta do Asaas
- Certifique-se de estar logado na conta correta


## ⚠️ Erro Encontrado

```
Não há nenhum domínio configurado em sua conta. 
Cadastre um site em Minha Conta na aba Informações.
```

## 📍 ONDE ENCONTRAR A CONFIGURAÇÃO DE DOMÍNIO

A configuração de domínio **NÃO está na página "Integrações"**. Siga estes passos:

### Passo a Passo:

1. **Acesse o painel do Asaas**: https://app.asaas.com/ ou https://www.asaas.com/
2. **Faça login** na sua conta
3. **Procure por um dos seguintes caminhos**:
   - Clique no seu **nome/perfil** no canto superior direito → **Minha Conta** → **Informações**
   - Ou vá em **Configurações** → **Informações da Conta**
   - Ou procure por **"Domínios"** ou **"Sites"** no menu lateral
4. **Procure pela seção "Domínios" ou "Sites"**
5. **Adicione seu domínio** (veja opções abaixo)

### Se não encontrar:

- **Tente procurar por**: "Configurações", "Perfil", "Minha Conta", "Informações"
- **Ou entre em contato com o suporte do Asaas** pelo chat (canto inferior direito da tela)

## 📋 Solução: Configurar Domínio no Painel do Asaas

### Para Desenvolvimento (Localhost)

O Asaas requer um domínio válido configurado. Para desenvolvimento local, você tem duas opções:

#### Opção 1: Usar LocalTunnel (Recomendado para testes)

1. **Instalar LocalTunnel** (se ainda não tiver):
   ```powershell
   npm install -g localtunnel
   ```

2. **Criar um túnel para a porta 3000**:
   ```powershell
   lt --port 3000
   ```

3. **Copiar a URL gerada** (exemplo: `https://xxxxx.loca.lt`)

4. **Configurar no Asaas**:
   - Acesse: https://www.asaas.com/
   - Faça login na sua conta
   - Vá em **Minha Conta** → **Informações**
   - Na seção **Domínios**, adicione o domínio do LocalTunnel (ex: `xxxxx.loca.lt`)
   - Salve as alterações

5. **Atualizar o código**:
   - Use a URL do LocalTunnel nas variáveis de ambiente ou no código

#### Opção 2: Usar ngrok (Alternativa)

1. **Instalar ngrok** (se ainda não tiver)
2. **Criar um túnel**:
   ```powershell
   ngrok http 3000
   ```
3. **Copiar a URL HTTPS gerada** (exemplo: `https://xxxxx.ngrok.io`)
4. **Configurar no Asaas** seguindo os mesmos passos da Opção 1

### Para Produção

1. **Acesse o painel do Asaas**: https://www.asaas.com/
2. **Faça login** na sua conta
3. **Vá em**: **Minha Conta** → **Informações**
4. **Na seção "Domínios"**, adicione seu domínio de produção (ex: `seusite.com.br`)
5. **Salve as alterações**

## 🔄 Após Configurar

1. Reinicie o servidor Next.js
2. Tente novamente o pagamento de teste

## 📝 Nota Importante

- O domínio precisa ser **HTTPS** (seguro)
- Para desenvolvimento, você pode usar LocalTunnel ou ngrok que fornecem URLs HTTPS gratuitas
- Em produção, use seu domínio real com certificado SSL

## 🆘 Problemas Comuns

### "Domínio não verificado"
- Aguarde alguns minutos após adicionar o domínio
- Verifique se o domínio está correto (sem `http://` ou `https://`, apenas o domínio)

### "Acesso negado"
- Verifique se você tem permissões de administrador na conta do Asaas
- Certifique-se de estar logado na conta correta
