# 🌐 Configurar Domínio Personalizado no Vercel

## ✅ Deploy Concluído!

O site está online em:
- `meu-site-produtor-13.vercel.app`

Agora vamos configurar o domínio `thouse-rec.com.br`.

---

## 📋 Passo a Passo

### 1. Acessar Configurações de Domínio

1. **No Vercel Dashboard:**
   - Vá em **Settings** → **Domains**
   - Ou clique no projeto → **Settings** → **Domains**

### 2. Adicionar Domínio

1. **Na seção "Domains":**
   - Clique em **"Add"** ou **"Add Domain"**
   - Digite: `thouse-rec.com.br`
   - Clique em **"Add"**

### 3. Configurar DNS

O Vercel vai mostrar as instruções de DNS. Você precisa configurar no seu provedor de domínio (onde você comprou o `thouse-rec.com.br`).

#### Opção A: Configurar como Domínio Principal (Recomendado)

**No seu provedor de DNS (Registro.br, GoDaddy, etc.):**

1. **Adicione um registro A:**
   - Tipo: `A`
   - Nome: `@` ou deixe em branco
   - Valor: `76.76.21.21` (IP do Vercel - verifique no Vercel se mudou)

2. **Adicione um registro CNAME para www:**
   - Tipo: `CNAME`
   - Nome: `www`
   - Valor: `cname.vercel-dns.com.` (ou o que o Vercel indicar)

#### Opção B: Usar CNAME (Mais Simples)

**No seu provedor de DNS:**

1. **Adicione um registro CNAME:**
   - Tipo: `CNAME`
   - Nome: `@` ou deixe em branco (pode não funcionar em todos os provedores)
   - Valor: `cname.vercel-dns.com.` (ou o que o Vercel indicar)

2. **Adicione um registro CNAME para www:**
   - Tipo: `CNAME`
   - Nome: `www`
   - Valor: `cname.vercel-dns.com.` (ou o que o Vercel indicar)

### 4. Aguardar Propagação DNS

- Pode levar de **alguns minutos a 48 horas**
- Geralmente leva **15-30 minutos**
- O Vercel vai mostrar o status: "Validating" → "Valid Configuration"

### 5. Verificar SSL

- O Vercel configura SSL automaticamente (HTTPS)
- Pode levar alguns minutos após a validação do DNS

---

## 🔍 Verificar Status

No Vercel Dashboard → Domains, você verá:
- ✅ **Valid Configuration** = DNS configurado corretamente
- ⏳ **Validating** = Aguardando propagação DNS
- ❌ **Invalid Configuration** = Verifique os registros DNS

---

## 💡 Dica

Se você comprou o domínio no **Registro.br**, você pode:
1. Acessar o painel do Registro.br
2. Ir em **DNS** → **Zona DNS**
3. Adicionar os registros conforme o Vercel indicar

---

## ⚠️ Importante

Após configurar o domínio, você precisará:
1. **Atualizar webhooks do Asaas** para usar o novo domínio
2. **Testar todas as funcionalidades** com o novo domínio
3. **Verificar se os emails** estão sendo enviados corretamente

---

**Avise quando configurar o DNS para eu te ajudar a verificar!**
