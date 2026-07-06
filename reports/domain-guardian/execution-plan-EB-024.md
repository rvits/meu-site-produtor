# Execution Plan — EB-024

**Gerado em:** 2026-07-05T22:43:10.632Z
**Item:** TODO na linha 29

## Resumo Executivo
Plano de implementação para EB-024: TODO na linha 29. Categoria Refatoração, prioridade Low, ROI 25. Refatoração de baixo risco: legacy_code Contexto de execução: Executar Commit C-01. Somente planejamento — nenhum código será alterado por este agente.

| Campo | Valor |
|-------|-------|
| Objetivo | TODO na linha 29 |
| Problema | Refatoração de baixo risco: legacy_code |
| Motivação | Remover ou documentar plano de migração |
| Impacto | Baixo — não afeta cliente diretamente · Melhora legibilidade e manutenção |
| Prioridade | Low |
| ROI | 25 |

## Arquivos
### Obrigatórios
- scripts/verificar-dados-usuario-producao.js
### Sensíveis
### Proibidos modificar
- 🚫 Invariantes F1-F8 sem revisão
- 🚫 Purge físico de Payment/Appointment arquivados
- 🚫 Remoção de idempotência do webhook Asaas
- 🚫 Alteração de ownership de cupom sem Guardian C1/X1

## Plano passo a passo
### Passo 1: Preparação e leitura de contexto
**Objetivo:** Confirmar escopo, ADRs e invariantes antes de qualquer alteração
**Risco:** Baixo · **Rollback:** N/A — somente leitura
**Arquivos:** docs/ai/domain-invariants.md, docs/ai/domain-map.md, scripts/verificar-dados-usuario-producao.js
**Conclusão:**
- [ ] ADR e invariantes revisados
- [ ] Escopo alinhado ao item do backlog

### Passo 2: Implementação do escopo
**Objetivo:** Refatoração de baixo risco: legacy_code
**Risco:** Baixo · **Rollback:** git revert
**Arquivos:** scripts/verificar-dados-usuario-producao.js
**Conclusão:**
- [ ] Build passa
- [ ] Sem regressão em smoke

### Passo 3: Validação Guardian e Decision
**Objetivo:** Neutro ou positivo
**Risco:** Baixo · **Rollback:** git revert se Guardian falhar
**Arquivos:** scripts/domain-guardian-runner.ts, scripts/domain-decision-engine.ts
**Conclusão:**
- [ ] domain-guardian-runner.ts exit 0
- [ ] Decision APPROVED ou REVIEW_REQUIRED

### Passo 4: Testes e revisão
**Objetivo:** Executar plano de testes e checklist do proprietário
**Risco:** Baixo · **Rollback:** git revert
**Arquivos:** —
**Conclusão:**
- [ ] npm run build
- [ ] Revisão humana aprovada

## ADRs
- **ADR-011** Domain Map — documentação estruturada de entidades

## Invariantes
- F1** | `Payment.asaasId` é único globalmente quando preenchido. | CRÍTICO |
- F4** | `Payment.type = agendamento` e `status = approved` deve ter `appointmentId` ou `appointmentIds` resolvíveis após efeitos pós-pagamento (`asaas-agendamento-payment-effects`, reconcile). | ALTO |
- A5/A8/A9: arquivamento soft, queries operacionais

## Guardian Checks
- F1
- F4

## Análise de risco
### O que pode quebrar?
- Agendamentos duplicados
- Disponibilidade incorreta
- Arquivados visíveis no checkout
### Validar primeiro
- Guardian exit 0 no estado atual
### Nunca modificar
- Invariantes F1-F8 sem revisão
- Purge físico de Payment/Appointment arquivados
- Remoção de idempotência do webhook Asaas
- Alteração de ownership de cupom sem Guardian C1/X1
### Pior consequência: Regressão localizada reversível com git revert

## Checklist Guardian
- [ ] node --experimental-strip-types scripts/domain-guardian-runner.ts
- [ ] node --experimental-strip-types scripts/domain-decision-engine.ts

## Limitações V1
- Plano gerado automaticamente — revisão humana obrigatória antes de implementar
- Arquivos inferidos do Knowledge Graph quando backlog não lista paths
- Passos genéricos por categoria — ajustar para item específico
- Não valida se arquivos existem no disco
- Migrations mencionadas no plano mas não executadas por este agente
- Alias ENG-xxx aceito como EB-xxx

---
_Implementation Executor — somente plano. Nenhum código foi alterado._