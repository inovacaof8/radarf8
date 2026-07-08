## Objetivo

Implementar o módulo **Workflow de Demandas** com aprovação parametrizável por etapa. A demanda só avança quando a etapa atual não exige aprovação **ou** quando o aprovador definido aprovou.

Observação: hoje o projeto não possui tabelas `workflow_*`. Portanto o plano cria a base do módulo já com essa regra embutida, sem retrabalho depois.

---

## 1. Schema (migração única)

### 1.1 `workflow` (definição do fluxo)
- name, description, area_id, status (active/inactive)

### 1.2 `workflow_steps`
- workflow_id, order_index, name, description
- default_responsible_type (`user` | `area_manager` | `creator` | `previous_step`)
- default_responsible_user_id, default_responsible_area_id
- sla_hours
- **`requires_approval` boolean default false**
- **`approver_type`** (`user` | `area_manager` | `configured`)
- **`approver_user_id`**, **`approver_area_id`**
- CHECK: se `requires_approval` = true → aprovador definido conforme `approver_type`

### 1.3 `workflow_demands`
- workflow_id, code (WF-####), title, description, priority
- current_step_id, current_responsible_id, **current_approver_id**
- created_by, created_at, due_at
- status: `open` | `in_progress` | `waiting_approval` | `rejected` | `completed` | `cancelled`

### 1.4 `workflow_demand_history`
- demand_id, step_id, action (`created` | `assigned` | `started` | `submitted_for_approval` | `approved` | `rejected` | `advanced` | `completed`)
- from_user_id, to_user_id, approver_id, comment, created_at

### 1.5 `workflow_notifications`
- demand_id, user_id, type (`assignment` | `approval_request` | `approved` | `rejected` | `overdue`), read_at

GRANTs + RLS para todas: leitura para admin/PMO/Diretor Geral e para envolvidos (criador, responsável atual, aprovador atual, gestor da área). Escrita conforme regra.

---

## 2. Lógica de avanço (funções SECURITY DEFINER)

### 2.1 `workflow_complete_step(_demand_id, _comment)`
Chamada pelo responsável atual.
- Se `requires_approval = false` → chama `workflow_advance(_demand_id)`.
- Se `requires_approval = true`:
  - `status = 'waiting_approval'`
  - `current_approver_id = resolve_approver(step, demand)`
  - **NÃO altera** `current_step_id` nem `current_responsible_id`
  - Histórico `submitted_for_approval`
  - Cria notificação `approval_request` para o aprovador

### 2.2 `workflow_approve(_demand_id, _comment)`
- Valida que `auth.uid() = current_approver_id`
- Histórico `approved`
- Chama `workflow_advance(_demand_id)`

### 2.3 `workflow_reject(_demand_id, _comment)` — comentário obrigatório
- Valida aprovador
- `status = 'rejected'`
- Mantém `current_step_id`, restaura `current_responsible_id` original da etapa
- Limpa `current_approver_id`
- Histórico `rejected` + notificação para responsável

### 2.4 `workflow_advance(_demand_id)` (interna)
- Busca próxima `workflow_steps` por `order_index`
- Se não existir → `status='completed'`
- Se existir:
  - `current_step_id` = próxima
  - `current_responsible_id` = resolvido conforme `default_responsible_type`
  - `current_approver_id = NULL`
  - `status = 'in_progress'`
  - `due_at = now() + sla_hours`
  - Histórico `advanced` + notificação para novo responsável

### 2.5 Trigger `workflow_demands_guard`
Bloqueia UPDATE direto de `current_step_id`/`current_responsible_id` quando `status='waiting_approval'` (garante que nada avance sem passar por `workflow_approve`).

---

## 3. Frontend

### 3.1 Rotas
- `/workflows` — lista de workflows (admin)
- `/workflows/:id/editar` — editor de etapas com toggle **"Exige aprovação"** e campos condicionais de aprovador
- `/demandas` — minhas demandas (responsável) + aba "Aguardando minha aprovação"
- `/demandas/:id` — detalhe com timeline (history), botões:
  - Responsável: **Concluir etapa**
  - Aprovador (quando `waiting_approval` e `current_approver_id = me`): **Aprovar** / **Rejeitar** (com comentário obrigatório)
  - Badges claras: `Aguardando aprovação de X`, `Rejeitada`, etc.

### 3.2 Editor de etapa (regras UI)
- Switch `Exige aprovação?` inicial = off
- Ao ligar: exibe select `Tipo de aprovador` + campos condicionais
- Validação Zod: não salvar etapa com `requires_approval=true` sem aprovador
- Aviso visual: "Esta etapa só avança após aprovação"

### 3.3 Notificações
Integrar ao sino existente (`notification` table) reaproveitando padrão atual: novo `source_type = 'workflow_demand'` com subtipos.

---

## 4. Permissões / RBAC

Novo módulo `workflows` com ações `view`, `create`, `edit`, `admin`, `approve`.
- Admin/PMO/Diretor Geral: tudo
- Gestor: cria workflows da sua área, aprova quando indicado
- Colaborador: vê apenas demandas onde é responsável, criador ou aprovador

---

## 5. Entregáveis por etapa de implementação

1. **Migração** completa (tabelas + GRANT + RLS + funções + triggers + módulo/perm)
2. **Types** regenerados
3. Hooks: `useWorkflows`, `useWorkflowSteps`, `useDemands`, `useDemand`, `useCompleteStep`, `useApprove`, `useReject`
4. Páginas: lista/editor de workflow, lista/detalhe de demanda
5. Componente `StepApprovalConfig` reutilizável
6. Menu lateral: novo item **Workflows** (admin) e **Demandas**
7. Teste manual do fluxo: sem aprovação → avança direto; com aprovação → trava em `waiting_approval`, aprovação avança, rejeição volta com motivo

---

## Perguntas antes de começar

1. **Escopo agora:** quer que eu já implemente **tudo** (schema + telas de admin + telas de demanda + notificações), ou só a **base + regra de aprovação** (schema, funções e telas mínimas de execução/aprovação) para depois evoluir?
2. **Aprovador "responsável parametrizado"** — no seu prompt aparece esse tipo. É um usuário fixo escolhido no cadastro da etapa (equivalente ao "usuário específico") ou é o responsável de outra etapa do mesmo workflow?
3. **Rejeição:** ao rejeitar, o responsável volta a ser exatamente o mesmo usuário que concluiu, ou é re-resolvido pela regra padrão da etapa (ex.: gestor da área atual)?