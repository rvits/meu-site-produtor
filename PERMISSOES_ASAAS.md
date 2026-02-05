# 🔐 Guia de Permissões do Asaas - Resumo Rápido

## ❓ Qual Permissão Escolher?

Quando você cria um token de API no Asaas, você verá opções para cada recurso:

### Para PAGAMENTOS (PAYMENT):

| Opção | O que permite | Devo escolher? |
|-------|---------------|----------------|
| **NENHUM** | Nada - não pode fazer nada com pagamentos | ❌ **NÃO** |
| **READ** | Só ler/consultar pagamentos existentes | ❌ **NÃO** |
| **WRITE** | Criar, editar e gerenciar pagamentos | ✅ **SIM - ESCOLHA ESTA!** |

### Para CLIENTES (CUSTOMER):

| Opção | O que permite | Devo escolher? |
|-------|---------------|----------------|
| **NENHUM** | Nada - não pode criar clientes | ⚠️ Funciona, mas não ideal |
| **READ** | Só consultar clientes existentes | ⚠️ Funciona, mas não ideal |
| **WRITE** | Criar e gerenciar clientes automaticamente | ✅ **RECOMENDADO** |

## ✅ Configuração Recomendada

Ao criar seu token, escolha:

```
PAYMENT:    [ ] Nenhum  [ ] Read  [✅] WRITE
CUSTOMER:   [ ] Nenhum  [ ] Read  [✅] WRITE
```

## 🚨 Erro Comum

Se você escolher **"Nenhum"** ou **"Read"** para PAYMENT, você receberá:

```
❌ insufficient_permission: A chave de API não tem as permissões necessárias.
Verifique se a chave possui o escopo PAYMENT:WRITE
```

## 🔧 Solução

1. Crie um **novo token** no painel do Asaas
2. Desta vez, escolha **WRITE** para PAYMENT
3. Atualize o token no arquivo `.env`
4. Reinicie o servidor
5. Teste novamente

## 📝 Nota Importante

- Você pode ter múltiplos tokens
- Cada token pode ter permissões diferentes
- Tokens antigos podem ser revogados sem afetar novos
- Sempre escolha **WRITE** para recursos que você precisa criar/editar
