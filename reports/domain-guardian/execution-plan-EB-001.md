# Execution Plan — EB-001

**Gerado em:** 2026-07-05T22:42:31.133Z
**Item:** Desbloquear decisão de deploy

## Resumo Executivo
Plano de implementação para EB-001: Desbloquear decisão de deploy. Categoria Correção, prioridade Critical, ROI 100. Revisar e dividir alterações pendentes para reduzir risco CRITICAL. Contexto de execução: Executar Commit C-01. Somente planejamento — nenhum código será alterado por este agente.

| Campo | Valor |
|-------|-------|
| Objetivo | Desbloquear decisão de deploy |
| Problema | Revisar e dividir alterações pendentes para reduzir risco CRITICAL. |
| Motivação | Permite merge seguro e deploy incremental. |
| Impacto | Reduz risco de regressão financeira em produção. · Melhora governança e entrega |
| Prioridade | Critical |
| ROI | 100 |

## Arquivos
### Obrigatórios
- reports/domain-guardian/decision.md
- scripts/domain-change-analyzer.ts
- scripts/domain-decision-engine.ts
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
**Arquivos:** docs/ai/domain-invariants.md, docs/ai/domain-map.md, reports/domain-guardian/decision.md, scripts/domain-change-analyzer.ts, scripts/domain-decision-engine.ts
**Conclusão:**
- [ ] ADR e invariantes revisados
- [ ] Escopo alinhado ao item do backlog

### Passo 2: Desbloquear dependências
**Objetivo:** Resolver bloqueios: Revisar e dividir alterações pendentes para reduzir risco CRITICAL.
**Risco:** Médio · **Rollback:** Reverter organização de commits
**Arquivos:** scripts/domain-change-analyzer.ts, scripts/domain-decision-engine.ts
**Conclusão:**
- [ ] Decision não BLOCKED para escopo reduzido
- [ ] PR < 50 arquivos

### Passo 3: Implementação do escopo
**Objetivo:** Revisar e dividir alterações pendentes para reduzir risco CRITICAL.
**Risco:** Alto · **Rollback:** git revert + redeploy
**Arquivos:** reports/domain-guardian/decision.md, scripts/domain-change-analyzer.ts, scripts/domain-decision-engine.ts
**Conclusão:**
- [ ] Guardian exit 0
- [ ] Decision não BLOCKED para escopo

### Passo 4: Validação Guardian e Decision
**Objetivo:** Validar com Guardian após implementação
**Risco:** Baixo · **Rollback:** git revert se Guardian falhar
**Arquivos:** scripts/domain-guardian-runner.ts, scripts/domain-decision-engine.ts
**Conclusão:**
- [ ] domain-guardian-runner.ts exit 0
- [ ] Decision APPROVED ou REVIEW_REQUIRED

### Passo 5: Testes e revisão
**Objetivo:** Executar plano de testes e checklist do proprietário
**Risco:** Baixo · **Rollback:** git revert + redeploy
**Arquivos:** —
**Conclusão:**
- [ ] Smoke test
- [ ] Guardian
- [ ] Sandbox Asaas se financeiro
- [ ] Revisão humana aprovada

## ADRs
- **ADR-001** Domain Guardian — verificação automática de invariantes
- **ADR-014** Vínculos lógicos sem FK — Payment → Appointment

## Invariantes
- F1** | `Payment.asaasId` é único globalmente quando preenchido. | CRÍTICO |
- F4** | `Payment.type = agendamento` e `status = approved` deve ter `appointmentId` ou `appointmentIds` resolvíveis após efeitos pós-pagamento (`asaas-agendamento-payment-effects`, reconcile). | ALTO |

## Guardian Checks
- F1
- F4

## Análise de risco
### O que pode quebrar?
- Regressão em build
- Decision BLOCKED persistente
### Validar primeiro
- Guardian exit 0 no estado atual
- Check F1 OK
- Check F4 OK
### Nunca modificar
- Invariantes F1-F8 sem revisão
- Purge físico de Payment/Appointment arquivados
- Remoção de idempotência do webhook Asaas
- Alteração de ownership de cupom sem Guardian C1/X1
- Regras de negócio não relacionadas ao item
### Pior consequência: Regressão localizada reversível com git revert

## Checklist Guardian
- [ ] node --experimental-strip-types scripts/domain-guardian-runner.ts
- [ ] node --experimental-strip-types scripts/domain-decision-engine.ts
- [ ] Check F1 sem erros
- [ ] Check F4 sem erros

## Limitações V1
- Plano gerado automaticamente — revisão humana obrigatória antes de implementar
- Arquivos inferidos do Knowledge Graph quando backlog não lista paths
- Passos genéricos por categoria — ajustar para item específico
- Não valida se arquivos existem no disco
- Migrations mencionadas no plano mas não executadas por este agente
- Alias ENG-xxx aceito como EB-xxx

---
_Implementation Executor — somente plano. Nenhum código foi alterado._