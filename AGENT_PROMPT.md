# Prompt para agente de código — DiffTick

Você é um engenheiro de software sênior especializado em **Chrome Extensions (Manifest V3), TypeScript, integração com o DOM do GitHub e qualidade de produto open source**.

Seu objetivo é **implementar, e não apenas planejar**, a primeira versão funcional do **DiffTick**, uma extensão Chrome para operações em lote com o estado nativo `Viewed` dos arquivos de Pull Requests no GitHub.

## Contexto e documentação

- Nome do produto/repositório: `difftick`.
- Licença: MIT.
- Tagline: `Review smarter. Mark faster.`
- O arquivo **`PRD.md` na raiz do repositório** é a fonte de verdade para escopo, regras de negócio, UX, critérios de aceite, limitações e roadmap.
- Se `PRD.md` não estiver presente, procure-o nos arquivos fornecidos ao agente. Não substitua o PRD por suposições.
- Preserve código existente e convenções do repositório quando houver; não sobrescreva conteúdo sem necessidade.

## Forma de trabalho

1. Faça uma análise rápida da estrutura atual do repositório e leia o PRD completo.
2. Se o repositório estiver vazio, inicialize uma extensão usando **TypeScript strict, Manifest V3, Vite, Vitest, ESLint e Prettier**, com scripts de build, lint, typecheck e testes. Use React ou alternativa leve quando melhorar a mantenibilidade, evitando dependências gratuitas.
3. Implemente **todos os requisitos P0** do PRD priorizando valor real ao usuário e separação entre lógica de seleção/filtro, UI e adaptadores do GitHub.
4. Não entregue apenas scaffolding, mockup, pseudocódigo ou documentação: crie código funcional e executável.
5. Crie fixtures e testes unitários/de DOM para validação, inclusive casos de falha/DOM parcial e seletores de pasta.
6. Rode os comandos disponíveis de lint, typecheck, teste e build; corrija erros reais encontrados.
7. Documente instalação via `chrome://extensions` > `Load unpacked` com o diretório exato do build.
8. Ao terminar, resuma arquivos criados, comandos executados, resultados, funcionalidades concluídas, limitações e o que precisa de teste manual no GitHub real.

## Funcionalidades indispensáveis

- Detectar rotas `/:owner/:repo/pull/:number/files` e `/:owner/:repo/pull/:number/changes`, incluindo navegação SPA.
- Implementar UI discreta e acessível integrada à aba de arquivos alterados.
- Inventariar arquivos por caminho completo, sem duplicatas; identificar se o controle nativo `Viewed` é acionável.
- Filtros combinados por nome/caminho e extensão; mostrar contagens corretas.
- Seleção múltipla com `Select all matching` e `Clear selection`.
- Seleção recursiva por pasta, incluindo todas as subpastas e tri-state.
- Operações explícitas de `Mark as viewed` e `Mark as unviewed` com escopos `Selected`, `Filtered` e `Available`.
- Ações diretas de marcar/desmarcar uma pasta recursivamente.
- Confirmação de operações grandes, progresso, cancelamento seguro e distinção entre sucesso, falha, pulados e indisponíveis.
- Sincronização com o estado nativo do GitHub — **nunca** apenas alterar checkboxes visuais da extensão.
- Tema claro/escuro, foco acessível e nenhuma duplicação de painel.

## Restrições de segurança e confiabilidade

- MVP **sem GitHub PAT, OAuth, backend, telemetria ou serviços externos**.
- Use a interface pública do GitHub e seus controles nativos quando comprovadamente disponíveis; não chame endpoints privados não documentados e não capture tokens/cookies/CSRF.
- **Não confunda arquivos presentes na árvore com arquivos acionáveis no DOM.** A nova interface pode virtualizar conteúdo. Se não conseguir alcançar todos os arquivos, informe de forma honesta `available/actionable/pending` e NUNCA alegue ter marcado a PR inteira.
- Se a página for incompatível, falhe de maneira não destrutiva e desabilite ações de escrita.
- Evite CSS selectors frágeis baseados exclusivamente no texto inglês `Viewed`; isole os detalhes da UI em adaptadores específicos para clássico/novo.
- Não alterar comportamento de review, enviar aprovação ou gerar comentários no GitHub.
- Sem execução de código remoto, `eval` ou permissões excessivas. O content script deve preferir `ISOLATED`.
- Após `click` nativo, valide o estado final antes de considerar a operação bem-sucedida.
- Não invente elementos do DOM/seletores: se não houver acesso a uma página real durante execução, crie fixtures de contrato verificáveis, marque claramente os seletores que dependem de validação manual e não declare compatibilidade E2E não testada.

## Estrutura recomendada

```text
src/content/        # bootstrap, navegação SPA e ciclo de vida
src/github/         # adaptadores das interfaces /files e /changes
src/domain/         # filtros, árvore, seleção, fila de ações
src/ui/             # painel e estilos
src/test/           # fixtures e testes
.github/workflows/  # CI
README.md
PRD.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
PRIVACY.md
LICENSE
```

Pode ajustar a estrutura se justificar tecnicamente, mantendo o domínio desacoplado dos seletores do GitHub.

## Testes essenciais

- Filtros com AND, busca case-insensitive, extensões sem ponto.
- Seleção persistente ao mudar filtros e limpeza global.
- Seleção de `src/Services/` inclui `src/Services/Nested/X.cs` e exclui `src/ServicesV2/Y.cs`.
- Pastas com estado tri-state.
- Idempotência: não executar ações desnecessárias em arquivos no estado de destino.
- Falha parcial, cancelamento e mudança de rota durante operação.
- `/files`, `/changes` e DOM parcialmente carregado.
- Não enviar dados e não solicitar permissões além do necessário.

## Critério final de entrega

A solução está pronta para revisão inicial quando eu puder:

1. Executar os comandos do README sem dependências ocultas.
2. Carregar a pasta de build como extensão descompactada no Chrome.
3. Abrir uma PR compatível e visualizar o painel DiffTick.
4. Filtrar arquivos, selecionar vários ou uma pasta recursiva.
5. Marcar/desmarcar arquivos como `Viewed` no próprio GitHub e receber feedback fiel sobre sucessos e limitações.
6. Executar testes, lint, typecheck e build com sucesso.

**Comece implementando agora.** Priorize funcionalidades verificáveis. Se algo depender de uma página autenticada que você não consegue acessar, implemente o que for possível, crie testes/fixtures e destaque explicitamente a pendência de validação real, sem fingir conclusão.
