# 🔐 Configurar Variáveis de Ambiente no Vercel

## 📋 Passo a Passo Detalhado

### 1. Acessar Configurações do Projeto

1. **No projeto do Vercel**, clique em **"Settings"** (no menu superior)
2. No menu lateral esquerdo, clique em **"Environment Variables"**

### 2. Adicionar Cada Variável

**Para cada variável abaixo:**
1. Clique em **"Add New"** ou **"Add"**
2. Cole o **Name** e **Value**
3. **Marque os ambientes:** Production, Preview, Development (todos)
4. Clique em **"Save"**

---

## 📝 Variáveis para Adicionar:

### 1. DATABASE_URL
```
Name: DATABASE_URL
Value: postgresql://neondb_owner:npg_5kOUmhWP1YiD@ep-soft-snow-acu3sq1b-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
Ambientes: ✅ Production ✅ Preview ✅ Development
```

### 2. SUPPORT_EMAIL
```
Name: SUPPORT_EMAIL
Value: thouse.rec.tremv@gmail.com
Ambientes: ✅ Production ✅ Preview ✅ Development
```

### 3. SUPPORT_EMAIL_PASSWORD
```
Name: SUPPORT_EMAIL_PASSWORD
Value: kjpexhpoqeqxycza
Ambientes: ✅ Production ✅ Preview ✅ Development
```

### 4. SUPPORT_DEST_EMAIL
```
Name: SUPPORT_DEST_EMAIL
Value: thouse.rec.tremv@gmail.com
Ambientes: ✅ Production ✅ Preview ✅ Development
```

### 5. ASAAS_API_KEY
```
Name: ASAAS_API_KEY
Value: $aact_YTU5YTE0M2M2N2I4MTIxNzliZDkxYWE5Y2I2NDRjMDM6OjAwMDAwMDAwMDAwMDAwNzU3NDY6OiRhYWNoXzE4YzM0NDNhLWE3YjEtNDY5ZC05YjM5LWM5ZDFhNzI4YjFjYw==
Ambientes: ✅ Production ✅ Preview ✅ Development
```

### 6. OPENAI_API_KEY
```
Name: OPENAI_API_KEY
Value: [Cole sua chave da OpenAI aqui - começa com sk-proj-...]
Ambientes: ✅ Production ✅ Preview ✅ Development
```

### 7. NODE_ENV
```
Name: NODE_ENV
Value: production
Ambientes: ✅ Production (apenas)
```

---

## ⚠️ IMPORTANTE:

- **Marque TODOS os ambientes** (Production, Preview, Development) para as variáveis 1-6
- **NODE_ENV** apenas em Production
- Após adicionar cada variável, clique em **"Save"**
- Verifique se todas as variáveis foram adicionadas corretamente

---

## ✅ Após Adicionar Todas as Variáveis:

1. Verifique se todas estão listadas
2. Me avise quando terminar
3. Continuaremos com o próximo passo (aplicar schema no banco)
