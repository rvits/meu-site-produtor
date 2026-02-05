# 🔑 Como Obter a Chave da OpenAI

## 📋 Opções:

### Opção 1: Verificar se você já tem uma chave

A chave da OpenAI geralmente está em um arquivo `.env` ou `.env.local` no seu computador. 

**Onde procurar:**
1. Na raiz do projeto: `C:\Users\raulv\Documents\projetos\meu-site-produtor\.env`
2. Ou: `C:\Users\raulv\Documents\projetos\meu-site-produtor\.env.local`

**Como verificar:**
- Abra o arquivo `.env` ou `.env.local` no seu editor
- Procure por uma linha que começa com `OPENAI_API_KEY=`
- A chave começa com `sk-proj-` ou `sk-`

---

### Opção 2: Criar uma nova chave (se não tiver)

Se você não tiver uma chave ou não conseguir encontrá-la:

1. **Acesse:** https://platform.openai.com/api-keys
2. **Faça login** na sua conta OpenAI (ou crie uma se não tiver)
3. **Clique em:** "Create new secret key"
4. **Dê um nome:** Ex: "THouse Rec - Vercel"
5. **Copie a chave** (ela só aparece uma vez!)
6. **Cole no Vercel** como variável de ambiente

**⚠️ IMPORTANTE:**
- A chave começa com `sk-proj-` (para contas novas) ou `sk-` (para contas antigas)
- Guarde a chave em um lugar seguro
- Você não conseguirá ver a chave completa novamente depois

---

### Opção 3: Usar temporariamente sem a chave

Se você não tiver a chave agora, pode:

1. **Adicionar as outras 6 variáveis primeiro** no Vercel
2. **Fazer o deploy** (o site funcionará, mas o chat AI não funcionará)
3. **Adicionar a `OPENAI_API_KEY` depois** quando conseguir

O site funcionará normalmente, apenas o chat AI ficará desabilitado até você adicionar a chave.

---

## ✅ Próximo Passo:

**Escolha uma opção:**
- ✅ Se já tem a chave: procure no arquivo `.env` ou `.env.local`
- ✅ Se não tem: crie uma nova em https://platform.openai.com/api-keys
- ✅ Se quiser adicionar depois: continue com as outras variáveis primeiro

**Me avise qual opção você escolheu!**
