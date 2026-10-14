# Avaliação — GitHub Actions com IA

**Repositório:** [Joao-FM7/oauth-pages-lab](https://github.com/Joao-FM7/oauth-pages-lab)  
**Projeto:** Cloudflare Pages + Pages Functions + banco D1 `oauth-sessions-unishift`.

## Tarefa 1 — CI a cada commit

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

- [Execução aprovada (#3)](https://github.com/Joao-FM7/oauth-pages-lab/actions/runs/38407727877).
- [Execução reprovada propositalmente (#5)](https://github.com/Joao-FM7/oauth-pages-lab/actions/runs/38408660466).
- Erro proposital no arquivo `migrations/0002_adiciona_coluna.sql`:

  ```sql
  ALTER TABLE notas ADD COLUMN ;
  ```

- Linha do log da falha: `Parse error near line 2: near ";": syntax error` (seguida de `Process completed with exit code 1`).
- Depois do teste, a migração foi corrigida para:

  ```sql
  ALTER TABLE notas ADD COLUMN nota REAL;
  ```

**Por que testar as migrações no SQLite antes de aplicar no D1?** Porque o D1 usa SQLite, e a validação local permite detectar erros de sintaxe ou de estrutura das migrações antes de executá-las no banco remoto.

## Tarefa 2 — Proteção da branch `main`

- [Pull Request #1 — teste de bloqueio do CI](https://github.com/Joao-FM7/oauth-pages-lab/pull/1): inicialmente bloqueado porque a migração SQL inválida fez o check `verificar` falhar.
- Após a correção na mesma branch `teste-ci-falha`, os checks foram aprovados e o botão de merge ficou disponível. O PR #1 foi depois integrado à `main`.
- Regra de proteção: exige Pull Request e o status check `verificar` aprovado.

**Resultado do teste `git push origin main` diretamente na `main`:**

```text
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Changes must be made through a pull request.
remote: - Required status check "verificar" is expected.
! [remote rejected] main -> main (push declined due to repository rule violations)
error: failed to push some refs
```

O push foi rejeitado. O commit local usado para esse teste foi descartado em seguida, sem modificar a `main` remota.

## Tarefa 3 — Revisão automática de PR por IA

Workflow: [`.github/workflows/revisao-ia.yml`](.github/workflows/revisao-ia.yml).

- [PR #1 com os comentários automáticos da IA](https://github.com/Joao-FM7/oauth-pages-lab/pull/1).
- **Primeira revisão:** identificou SQL construído por concatenação em `functions/api/me.js` e recomendou `prepare().bind()`.
- **Segunda revisão:** após a correção, reconheceu que a consulta passou a usar `prepare().bind()` e que não havia mais aquela concatenação vulnerável.
- [Execução aprovada da revisão por IA](https://github.com/Joao-FM7/oauth-pages-lab/actions/runs/38471952912).
- [Teste proposital sem `pull-requests: write` — execução reprovada](https://github.com/Joao-FM7/oauth-pages-lab/actions/runs/38569787859).
- Erro registrado no log da etapa **Comenta no PR**: `GraphQL: Resource not accessible by integration (addComment)`.
- A permissão `pull-requests: write` foi restaurada, e as revisões automáticas voltaram a passar.

**Análise crítica de uma afirmação da IA:** A IA afirmou, em uma das revisões, que `steps.ia.outputs.response-file` era um output incorreto e que a publicação do comentário falharia. A própria execução do workflow, porém, publicou comentários com sucesso usando esse output, o que contradiz a afirmação; portanto, uma sugestão de IA deve ser confrontada com a documentação e com o comportamento efetivamente observado antes de ser aceita.

**Adaptação técnica:** Para fazer a revisão funcionar com Copilot, foi usada uma referência fixada da ação `actions/ai-inference` compatível com esse provedor e `model: ""`, após a indisponibilidade de `gpt-4.1` na execução anterior.

## Tarefa 4 — Migrações D1 depois do merge

Workflow: [`.github/workflows/migrar.yml`](.github/workflows/migrar.yml), configurado para `push` na `main` somente com alterações em `migrations/**`.

- [Execução da migração após o merge do PR #1](https://github.com/Joao-FM7/oauth-pages-lab/actions/runs/38577979203).
- Banco remoto: `oauth-sessions-unishift`.
- Migrações concluídas: `0001_cria_notas.sql` e `0002_adiciona_coluna.sql`.
- Consulta de verificação executada no console remoto da Cloudflare:

  ```sql
  PRAGMA table_info(notas);
  ```

| cid | name | type | notnull | pk |
| ---: | --- | --- | ---: | ---: |
| 0 | `id` | `INTEGER` | 0 | 1 |
| 1 | `aluno` | `TEXT` | 1 | 0 |
| 2 | `nota` | `REAL` | 0 | 0 |

A coluna `nota REAL` foi confirmada no D1 remoto.

**Segundo merge sem alterações em `migrations/`:** COMPROVADO. O [Pull Request #2 — entrega da avaliação](https://github.com/Joao-FM7/oauth-pages-lab/pull/2) alterou somente o arquivo `AVALIACAO.md` e foi integrado à `main`. Após esse segundo merge, o [histórico do workflow `migrar`](https://github.com/Joao-FM7/oauth-pages-lab/actions/workflows/migrar.yml) continuou mostrando **apenas 1 execução**, correspondente ao merge do PR #1 ([execução #1](https://github.com/Joao-FM7/oauth-pages-lab/actions/runs/38577979203)); nenhuma execução foi disparada pelo PR #2. Assim, ficou comprovado que o filtro `paths: ['migrations/**']` impediu a execução quando só a documentação foi alterada.

## Bônus — Resumo das migrações por IA

- [Execução com o resumo no `$GITHUB_STEP_SUMMARY`](https://github.com/Joao-FM7/oauth-pages-lab/actions/runs/38577979203).
- A IA resumiu a aplicação bem-sucedida dos arquivos `0001_cria_notas.sql` e `0002_adiciona_coluna.sql` no banco remoto.

## Perguntas

### 1. Por que o `ci.yml` roda duas vezes num push para uma branch com PR aberto? Qual execução conta para a proteção da `main`?

Porque o workflow está configurado para os eventos `push` e `pull_request`: atualizar uma branch com PR aberto gera um push e também atualiza o PR (`synchronize`). Para liberar o merge, a regra da `main` exige que o status check `verificar` associado ao PR esteja aprovado; uma execução verde isolada não substitui os checks exigidos na proteção.

### 2. Por que um PR vindo de um fork não recebe `secrets.COPILOT_PAT`? Qual ataque essa regra impede?

Porque o código de um fork pode ser controlado por alguém que não administra o repositório de destino, e o GitHub não repassa normalmente esses segredos para workflows acionados por `pull_request` de forks. Isso dificulta que um colaborador malicioso altere o workflow para extrair o token Copilot ou outras credenciais secretas.

### 3. Por que o workflow da Tarefa 3 declara `permissions` em vez de usar as permissões padrão do `GITHUB_TOKEN`?

Para conceder somente os privilégios necessários: `contents: read` para ler o código e `pull-requests: write` para publicar o comentário no PR. O teste mostrou que, sem a permissão de escrita, a revisão era gerada, mas o comando de publicação falhava com `Resource not accessible by integration`.

### 4. A revisão da IA pode substituir o status check da Tarefa 2? Justifique com a observação da Tarefa 3.

Não. A IA pode apontar problemas e também cometer erros, como a afirmação incorreta sobre `response-file`, enquanto o status check executa verificações automatizadas e a regra de proteção impede efetivamente o merge quando um check obrigatório falha.
