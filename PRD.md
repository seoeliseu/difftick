# DiffTick — Product Requirements Document (PRD)

**Versão:** 1.0 (MVP)  
**Status:** Pronto para implementação inicial  
**Data:** 22/10/2026  
**Repositório:** `difftick`  
**Licença:** MIT  
**Produto:** extensão de navegador para auxiliar code reviews de GitHub Pull Requests  
**Idioma inicial:** inglês (interface); documentação principal em inglês, podendo incluir português

---

## 1. Visão do produto

**DiffTick** é uma extensão open source para Chrome que agiliza a revisão de arquivos em Pull Requests do GitHub. O foco é permitir **seleção em lote, filtros e marcação/desmarcação do estado nativo `Viewed`**, inclusive de pastas completas com subpastas, sem alterar a experiência de revisão do GitHub mais do que o necessário.

**Tagline:** *Review smarter. Mark faster.*

### 1.1 Problema

Em Pull Requests com dezenas ou centenas de arquivos, marcar individualmente arquivos como `Viewed` exige muitos cliques. A dificuldade aumenta quando o desenvolvedor deseja marcar somente uma pasta, todos os arquivos de determinada extensão ou um subconjunto filtrado.

### 1.2 Proposta de valor

- Selecionar múltiplos arquivos de uma vez.
- Marcar ou desmarcar arquivos como `Viewed` em lote.
- Selecionar uma pasta de forma recursiva, incluindo todas as subpastas.
- Filtrar por nome, caminho e extensão.
- Manter o comportamento e o estado nativo do GitHub como fonte de verdade.
- Funcionar sem conta adicional, backend ou coleta de dados no MVP.

### 1.3 Público-alvo

Desenvolvedores, tech leads, revisores de PRs, maintainers de projetos open source e equipes com Pull Requests grandes.

## 2. Objetivos, métricas e princípios

### 2.1 Objetivos de negócio/produto

1. Reduzir o número de interações repetitivas durante o code review.
2. Facilitar o controle de arquivos relevantes sem sair da página do PR.
3. Oferecer uma base confiável para contribuições da comunidade.

### 2.2 Indicadores de qualidade para o MVP

- 100% dos testes de critérios de aceite essenciais aprovados no ambiente de desenvolvimento.
- Não modificar arquivos fora do escopo selecionado.
- Não reportar operações parciais como concluídas integralmente.
- Não executar ações de marcação sem iniciativa explícita do usuário.
- Não introduzir erros no console nem duplicar a interface durante navegação dinâmica.
- Operações perceptivelmente responsivas para conjuntos típicos de dezenas de arquivos; medir em testes reais antes de estabelecer SLA.

### 2.3 Princípios de UX

- **Selecionar é diferente de marcar:** a seleção é transitória e não altera o GitHub; `Viewed` é uma mudança real do estado do PR.
- **Escopo explícito:** sempre mostrar se a ação afeta os selecionados, filtrados ou todos os arquivos disponíveis.
- **Seguro por padrão:** nenhuma operação em massa deve ocorrer ao aplicar um filtro ou selecionar uma pasta.
- **Compatibilidade e honestidade:** nunca alegar suporte a arquivos que não estão acessíveis à integração.
- **Interferência mínima:** UI integrada ao layout do GitHub, sem quebrar comentários, diff, navegação e atalhos existentes.

## 3. Escopo do MVP (P0)

### RF-01 — Ativação e detecção de PR

- A extensão atua somente em páginas de alteração de arquivos de Pull Requests no `github.com`.
- Reconhece tanto `/OWNER/REPO/pull/NUMBER/files` quanto `/OWNER/REPO/pull/NUMBER/changes`, inclusive query strings e navegação interna do GitHub.
- Fora dessas rotas, não injeta a interface de revisão.
- Não deve exibir múltiplas instâncias ao navegar sem recarregar a página.
- Suporta a experiência clássica e a nova por adaptadores independentes, com *fallback* seguro.

**Aceite:** ao navegar entre PRs ou abas de um PR, a UI é montada/desmontada corretamente, sem vazamento de listeners ou ações direcionadas ao PR anterior.

### RF-02 — Descoberta e catálogo de arquivos

- Cada arquivo detectado deve possuir um identificador estável baseado no **caminho completo** dentro do PR.
- Registrar nome, caminho, extensão, pasta e estado `Viewed`/`Unviewed` quando observáveis de forma confiável.
- Tratar arquivos em subpastas, na raiz, sem extensão, dotfiles e nomes com espaços/Unicode.
- Evitar entradas duplicadas oriundas da árvore lateral e do painel de diff.
- Não presumir que os elementos do DOM representam todos os arquivos do PR.

**Aceite:** contagens da interface refletem apenas arquivos efetivamente conhecidos e uma mesma entrada não é contada duas vezes.

### RF-03 — Filtros combináveis

- Campo de busca textual por nome ou caminho completo (sem distinção de maiúsculas/minúsculas).
- Filtro por extensão: aceitar `.cs`, `cs`, `.ts`, `.tsx`, `.json`, etc.; normalizar entradas.
- Filtro por caminho/pasta: correspondência por segmentos, não por simples prefixo incorreto.
- Combinar critérios diferentes por **AND** (busca E extensão E pasta).
- `Clear filters` limpa os filtros, mas **não** modifica `Viewed` nem a seleção.
- Mostrar `N matching / M available` e um estado vazio quando não há correspondências.

**Aceite:** buscar `service`, escolher `.cs` e pasta `src/` retorna apenas arquivos `.cs` dentro de `src/` cujo caminho/nome contenha `service`.

### RF-04 — Seleção múltipla independente de `Viewed`

- Checkboxes de seleção DiffTick para cada arquivo conhecido.
- `Select all matching`: selecionar todos os arquivos que correspondem aos filtros atuais, mantendo a seleção anterior (união, sem duplicatas).
- `Clear selection`: limpar toda a seleção, mesmo arquivos ocultos pelo filtro atual.
- Contador `N selected` sempre visível.
- Seleções persistem durante a alteração dos filtros, enquanto o usuário permanecer no mesmo PR e a entrada continuar válida.
- Ações de seleção nunca alteram `Viewed`.

**Aceite:** selecionar 3 arquivos de `.cs`, alterar o filtro para `.json`, selecionar 2 e limpar o filtro resulta em 5 arquivos selecionados, sem qualquer modificação no GitHub.

### RF-05 — Seleção recursiva por pasta

- Exibir uma árvore hierárquica (derivada dos caminhos conhecidos) ou controles de pasta em uma lista agrupada.
- Checkbox de pasta seleciona ou desmarca **todos os arquivos descendentes**, inclusive subpastas em qualquer profundidade.
- Checkbox de pasta tem estado `checked`, `unchecked` e `indeterminate`.
- Seleção recursiva independe de filtro, quando acionada diretamente na árvore; a UI deve indicar claramente esse comportamento.
- Caminhos devem usar limites de segmento: `src/api/` não corresponde a `src/api-v2/`.
- Pastas e arquivos com nomes iguais em níveis diferentes não podem se confundir.

**Aceite:** selecionar `src/Modules/` inclui `src/Modules/A.cs` e `src/Modules/B/More/C.cs`, mas não `src/ModulesExtra/D.cs`.

### RF-06 — Alteração em lote do estado nativo `Viewed`

- Botões separados `Mark as viewed` e `Mark as unviewed`.
- Antes de executar, exigir escolha explícita do escopo:
  - **Selected** (padrão): arquivos selecionados.
  - **Filtered**: todos os arquivos conhecidos que correspondem aos filtros ativos.
  - **Available**: todos os arquivos conhecidos pela extensão nesta página/PR.
- Mostrar uma prévia do número de arquivos afetados e a ação pretendida.
- Para operações com mais de 25 arquivos ou escopo `Available`, pedir confirmação breve; fornecer configuração adicional somente se demonstrada necessidade.
- Aplicar somente a arquivos cujo estado precisa mudar, quando estado atual é conhecido; se desconhecido, tratar como não elegível até verificação confiável.
- Usar controles nativos `Viewed` do GitHub no MVP sem automatizar aprovações nem submissão de review.
- Verificar o resultado após interação; não considerar `click()` como prova de persistência.
- Processar de maneira controlada, com progresso e possibilidade de cancelar itens ainda pendentes.
- Exibir sucesso, falha e pulados separadamente; permitir tentar novamente os erros.

**Aceite:** com 15 selecionados (5 já `Viewed`), `Mark as viewed` não altera arquivos fora da seleção; processa apenas os que precisam mudar; contagem final representa estados realmente observados após a operação.

### RF-07 — Ação rápida de pasta

- Cada pasta pode apresentar `Mark folder as viewed` e `Unmark folder` como ações explícitas, separadas do checkbox de seleção.
- Essas ações abrangem descendentes recursivos **conhecidos e elegíveis**, incluindo subpastas.
- Exibir contagem e confirmar escopo antes de modificar o GitHub.
- Se algum descendente não estiver acessível para acionamento, mostrar aviso claro e não afirmar conclusão global.

**Aceite:** a ação em `src/Domain/` não afeta `src/Infrastructure/` e informa qualquer arquivo que não pôde ser processado.

### RF-08 — Progressão, erros e cancelamento

- Barra/contador de progresso: `processed / eligible`, com resultados `succeeded`, `failed`, `skipped`.
- Botão `Cancel` interrompe **novas** operações (não promete desfazer as já executadas).
- Operações não podem se sobrepor no mesmo PR; desabilitar ações conflitantes enquanto uma ação estiver ativa.
- Falhas individuais não interrompem necessariamente a fila; respeitar erros de autenticação/bloqueio/rate limit com parada segura.
- Não fazer retries agressivos nem loops infinitos.
- Após concluir, revalidar os estados conhecidos.

### RF-09 — Disponibilidade e limites honestos

**Ponto crítico do MVP:** a nova UI do GitHub pode virtualizar/carregar arquivos sob demanda. Assim, arquivos listados na árvore podem não ter um checkbox `Viewed` interagível no DOM.

- Diferenciar `known files`, `actionable files` e, se disponível de fonte confiável, `total PR files`.
- Usar linguagem **`Available files`**, nunca `Entire PR`, quando não houver garantia de cobertura completa.
- Se o usuário selecionar arquivos que não possuem controles nativos acessíveis, avisar explicitamente quantos ficaram pendentes/não suportados.
- Não rolar a página indiscriminadamente, não buscar endpoints internos não documentados e não forçar um estado visual local como se estivesse salvo no GitHub.
- Para arquivos não processáveis, mostrar orientação útil (ex.: abrir/expandir os diffs e repetir a ação).
- Suporte completo a todos os arquivos, inclusive não renderizados, requer uma evolução autenticada com a API oficial do GitHub (fora do escopo do MVP).

**Aceite:** uma PR com 100 arquivos conhecidos e 60 controles acionáveis não pode exibir `100 successfully marked` após processar só 60.

### RF-10 — Acessibilidade, temas e responsividade

- UI compacta no contexto da aba de alterações, sem sobrepor comentários ou botões nativos.
- Suporte a temas claro/escuro e variações de contraste do GitHub com tokens ou variáveis e *fallbacks* próprios.
- Controles com labels explícitos, foco visível, navegação por teclado, estados sem depender somente de cor e `aria-live` para progresso.
- Layout responsivo para larguras comuns de desktop; preservar scroll e posição da página.
- Interface inicial em inglês; strings centralizadas para futura localização `pt-BR`.

### RF-11 — Segurança e privacidade

- Manifest V3.
- Inicialmente apenas `github.com` e rotas de Pull Request; nenhuma permissão global de sites.
- Não solicitar GitHub PAT nem OAuth no MVP, não ter backend, não coletar conteúdo dos diffs, não enviar dados para terceiros.
- Não armazenar tokens, cookies, credenciais, código de repositórios nem telemetria.
- Sem `eval`, remote code, injeção de HTML não sanitizado ou dependências desnecessárias.
- No README e na publicação, informar: não afiliado ao GitHub; propósito e escopo das permissões.
- Revisar política de privacidade antes de publicar na Chrome Web Store.

## 4. Fluxos principais

### Fluxo A — Marcar arquivos após filtro

1. Usuário abre `Files changed` de uma PR.
2. DiffTick apresenta a lista de arquivos disponíveis.
3. Usuário busca `Tests/` e filtra `.cs`.
4. Usuário clica `Select all matching` (ou usa o escopo `Filtered` diretamente).
5. Escolhe `Mark as viewed`.
6. DiffTick apresenta escopo e quantidade elegível e executa após confirmação quando exigida.
7. Exibe o resultado verificado, inclusive eventuais arquivos não acessíveis.

### Fluxo B — Marcar uma pasta com todas as subpastas

1. Usuário expande `src/Services` na árvore DiffTick.
2. Clica `Mark folder as viewed` na pasta.
3. DiffTick calcula recursivamente descendentes conhecidos (incluindo subpastas).
4. Exibe prévia `X arquivos`, com ressalva de disponibilidade, se necessária.
5. Executa a marcação controlada e atualiza os estados.

### Fluxo C — Desmarcar arquivos já revisados

1. Usuário escolhe os arquivos ou utiliza filtros.
2. Seleciona o escopo `Selected` ou `Filtered`.
3. Clica `Mark as unviewed`.
4. DiffTick altera apenas o estado nativo relevante, exibe progresso e resultado.

## 5. Layout funcional proposto

```text
┌────────────────────────── DiffTick ──────────────────────────┐
│ Review smarter. Mark faster.                               │
├──────────────────────────────────────────────────────────────┤
│ Search name/path...         [Extension: .cs ▾] [Clear]       │
│ Folder/path filter...                                       │
│ 24 matching / 86 available      8 selected                  │
│ [Select all matching] [Clear selection]                     │
├──────────────────────────────────────────────────────────────┤
│ ▾ src/                         [Mark folder ▾]              │
│   ▾ Services/   ◪                                           │
│     ☐ CustomerService.cs      Unviewed                     │
│     ☑ PaymentService.cs       Viewed                       │
│   ▸ Domain/      ☐                                          │
│ ▸ tests/          ☐                                         │
├──────────────────────────────────────────────────────────────┤
│ Scope: (●) Selected  ( ) Filtered  ( ) Available             │
│ [Mark as viewed] [Mark as unviewed]                          │
│ Processing: 7/8  ·  Success 7 · Failed 0  [Cancel]          │
└──────────────────────────────────────────────────────────────┘
```

**Observação:** o esboço é conceitual. O agente deve integrar os controles ao GitHub com visual nativo e evitar duplicar os mecanismos já existentes sem necessidade.

## 6. Priorização

| Prioridade | Recurso | Fase |
|---|---|---|
| P0 | Detecção das duas rotas, montagem/limpeza do painel | MVP |
| P0 | Descoberta de arquivos e estado nativo observável | MVP |
| P0 | Busca por nome/caminho e filtro de extensão | MVP |
| P0 | Seleção múltipla e seleção de todos os filtrados | MVP |
| P0 | Árvore de pastas e seleção recursiva | MVP |
| P0 | Marcar/desmarcar como `Viewed`, com escopo explícito | MVP |
| P0 | Ação em pasta recursiva, feedback, erros e limites | MVP |
| P0 | Testes, README, CONTRIBUTING, MIT e CI | MVP |
| P1 | Atalhos de teclado configuráveis | Pós-MVP |
| P1 | Exclusões por glob, favoritos e presets de filtros | Pós-MVP |
| P1 | Integração GraphQL autenticada para arquivos não renderizados | Pós-MVP |
| P1 | Firefox/Edge | Pós-MVP |
| P1 | Localização pt-BR e outras línguas | Pós-MVP |
| P2 | Indicadores analíticos adicionais por pasta e regras personalizadas | Futuro |

## 7. Requisitos técnicos e arquitetura

### 7.1 Stack recomendada

- TypeScript em `strict` mode.
- Chrome Extension Manifest V3.
- Vite para build da extensão.
- UI leve: React é aceitável se não aumentar demais o bundle; Preact ou DOM + TypeScript também são válidos. Priorizar manutenibilidade.
- Vitest para testes unitários/de integração de DOM.
- Playwright para testes E2E quando viável, usando fixtures de DOM e Chrome com extensão carregada; testes manuais reais no GitHub continuam necessários.
- ESLint + Prettier; npm com lockfile e scripts reproduzíveis.
- Sem servidor e sem banco de dados.

### 7.2 Módulos sugeridos

```text
src/
  content/
    index.ts                  # bootstrap do content script
    navigation.ts             # navegação SPA, montagem, limpeza
  github/
    types.ts                  # FileRecord, ViewedState, Adapter...
    adapter.ts                # contrato do adaptador
    classic-adapter.ts        # UI /files quando clássica
    changes-adapter.ts        # UI /changes
    detect-adapter.ts         # feature detection, sem suposições frágeis
  domain/
    path-utils.ts             # pastas, descendentes, extensão
    filter-files.ts           # filtros combináveis
    selection.ts              # seleção independente de viewed
    operations.ts             # fila controlada + estados + cancelamento
  ui/
    panel.tsx                 # apresentação (extensão TSX se framework)
    styles.css
    strings.ts
  test/
    fixtures/
    unit/
    integration/
.github/workflows/ci.yml
CONTRIBUTING.md
CODE_OF_CONDUCT.md
LICENSE
README.md
PRIVACY.md
```

A estrutura pode ser adaptada pelo agente conforme escolha de framework, sem sacrificar separação de responsabilidades.

### 7.3 Modelo de domínio

```ts
type ViewedState = 'viewed' | 'unviewed' | 'unknown';

type FileRecord = {
  path: string;             // ex.: src/Services/CustomerService.cs
  name: string;
  directory: string;        // ex.: src/Services
  extension: string | null;
  viewedState: ViewedState;
  actionable: boolean;
};

type ActionScope = 'selected' | 'filtered' | 'available';
type ViewedAction = 'mark-viewed' | 'mark-unviewed';
```

`actionable` significa que existe mecanismo **suportado e comprovado** para alterar aquele arquivo, não apenas que seu nome consta na árvore. Persistir estado `Viewed` localmente como fonte principal **não** é permitido.

### 7.4 Adapters para GitHub

O agente deve inspecionar a interface vigente e fornecer adaptadores distintos (ou uma estratégia equivalente) para as experiências clássica e nova.

Contrato conceitual:

```ts
interface GithubFilesAdapter {
  isSupported(): boolean;
  listFiles(): FileRecord[];
  getViewedState(path: string): ViewedState;
  setViewed(path: string, viewed: boolean, signal?: AbortSignal): Promise<void>;
  dispose(): void;
}
```

- Se a UI for desconhecida, desabilitar escrita e mostrar erro não destrutivo.
- Preferir atributos semânticos estáveis a seletores CSS altamente acoplados à implementação.
- Não depender do idioma visível `Viewed` como único sinal.
- Deduplicar por caminho completo.
- Navegação GitHub tipo SPA: monitorar eventos conhecidos e DOM com `MutationObserver` limitado/debounced; limpar observers e listeners ao sair.
- `setViewed` deve verificar/confirmar mudança do estado quando possível, com timeout e erro tratável.

### 7.5 Lote, concorrência e segurança

- Processar sequencialmente no início; otimizar depois de medições.
- Ignorar operações no mesmo estado; separar `skipped` de `succeeded`.
- Usar `AbortController` para impedir novas ações quando cancelado.
- Rate-limit e falhas persistentes devem parar ou desacelerar operações, nunca provocar repetição ilimitada.
- Recalcular os alvos no clique, não apenas na abertura do painel.
- Não disparar duas filas simultâneas.
- Não usar APIs privadas do GitHub ou simular credenciais.

## 8. Limitações conhecidas e decisões explícitas

1. **UI dinâmica e parcialmente renderizada:** não é seguro afirmar que todas as entradas de uma PR estão acessíveis. A versão 1.0 opera sobre o conjunto conhecido/acionável, sempre explicando a cobertura.
2. **GitHub muda o layout:** a implementação deve evitar acoplamento profundo e falhar sem efeitos colaterais quando seletores deixarem de funcionar.
3. **Sem autenticação adicional:** o MVP reutiliza a interação do usuário com os controles do site, sem PAT, OAuth ou chamadas autenticadas próprias.
4. **Sem rollback automático:** cancelamento não desfaz alterações previamente concluídas. Não criar rollback fictício.
5. **Escopo do estado:** `Viewed` é estado nativo do GitHub, não equivale à submissão formal de uma revisão nem a uma aprovação. O GitHub pode desmarcar um arquivo depois de novas alterações nele.
6. **GitHub Enterprise Server:** fora do MVP, pela variedade de hosts e versões.
7. **Acesso de leitura/revisão:** a extensão deve respeitar o que a interface permite ao usuário autenticado; nunca contornar permissões.

## 9. Critérios de aceite consolidados

- [ ] Painel carrega uma única vez em `/files` e `/changes` e desaparece fora dessas rotas.
- [ ] Funciona com tema claro e escuro e navegação pelo teclado.
- [ ] Arquivos com caminhos idênticos não são duplicados ao combinar tree e diff.
- [ ] Busca textual é case-insensitive e filtros se combinam com AND.
- [ ] `Select all matching` seleciona somente os matches sem alterar `Viewed`.
- [ ] `Clear selection` limpa inclusive itens selecionados ocultos pelo filtro.
- [ ] Seleção de pasta inclui descendentes recursivos e não inclui prefixos parecidos.
- [ ] Pasta com seleção parcial apresenta estado indeterminado.
- [ ] `Mark as viewed`/`Mark as unviewed` atuam somente no escopo explicitado.
- [ ] Botões de ação são desabilitados quando não existem alvos elegíveis.
- [ ] Operações em lote possuem confirmação conforme regra, progresso e cancelamento seguro.
- [ ] Falhas ou itens inacessíveis são mostrados separadamente dos sucessos.
- [ ] Não informa sucesso de arquivos não processados/carregados.
- [ ] Mudar de PR durante operação interrompe novos trabalhos de forma segura.
- [ ] Nenhuma ação em lote é realizada ao simplesmente carregar a extensão.
- [ ] Nenhuma informação de código, credenciais ou diffs é transmitida a terceiros.
- [ ] `npm run build`, `npm run lint`, `npm run typecheck` e `npm test` executam sem erros (ajustar scripts à stack real).
- [ ] Extensão carrega por `chrome://extensions` > `Load unpacked` e demonstra o fluxo principal em PR real/fixture representativa.
- [ ] README descreve instalação, funcionamento, limites, contribuições, licença e teste local.

## 10. Qualidade, testes e contribuição open source

### 10.1 Testes obrigatórios

- `path-utils`: pasta raiz, subpastas, prefixos semelhantes, Unicode, arquivos com/sem extensão e dotfiles.
- `filter-files`: busca, extensão, caminho, combinação AND, filtros vazios.
- `selection`: múltipla seleção, persistência após mudar filtro, seleção recursiva, tri-state.
- `operations`: idempotência, falha parcial, cancelamento, mudança de rota, contagem correta.
- `adapters`: fixtures mínimas representando GitHub clássico e novo, estado desconhecido e DOM parcial.
- Teste manual: PR com ~10, ~100 e, quando viável, mais arquivos, incluindo pastas profundas e arquivos já visualizados.

### 10.2 Documentos do repositório

- `README.md`: finalidade, gif/screenshot (se disponível), principais recursos, build e instalação local.
- `CONTRIBUTING.md`: ambiente, comandos, padrões, testes, fluxo de PR e review.
- `CODE_OF_CONDUCT.md`: modelo comunitário reconhecido.
- `LICENSE`: MIT com ano e nome do titular corretos; não inventar titular, usar placeholder se faltar informação.
- `PRIVACY.md`: política clara e compatível com o comportamento implementado.
- `.github/ISSUE_TEMPLATE/`: bug e feature request.
- `.github/workflows/ci.yml`: lint, typecheck, testes e build por PR.
- Dependabot/Renovate opcional no MVP.

## 11. Roadmap após MVP

### V1.1 — Produtividade

- Glob patterns para inclusões/exclusões (`**/*.test.ts`, `!**/generated/**`).
- Presets locais de filtros.
- Atalhos de teclado.
- Localização pt-BR.

### V2 — Cobertura completa de PRs grandes

Investigar integração **autenticada** e **documentada** com a GraphQL API do GitHub:

- Consultar arquivos com paginação e `viewerViewedState`.
- Executar `markFileAsViewed` e `unmarkFileAsViewed` usando ID do PR + `path`.
- Priorizar fluxo seguro de autenticação e consentimento, preferencialmente GitHub App/OAuth apropriado.
- Definir permissões mínimas e armazenamento seguro; nunca colocar tokens em logs, DOM, URLs ou repositório.
- Operações completas deverão mostrar limites/paginação e lidar com falhas e rate limits.
- **Não** implementar via endpoints privados ou captura de sessão/cookies.

### V2.1 — Multinavegador

Suporte ao Firefox e Edge, após revisão das APIs e do sistema de build.

## 12. Fora do escopo

- Aprovar/rejeitar PR automaticamente.
- Submeter review, comentar ou alterar código.
- IA para análise de diffs.
- Uso fora do GitHub.com ou GitHub Enterprise Server no MVP.
- Analytics, telemetria, servidor próprio, sync de contas.
- Solicitar tokens para simplesmente instalar a extensão.

## 13. Fontes técnicas de referência

- GitHub Docs — Revisão de alterações e `Viewed`: https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request
- GitHub Changelog — nova experiência de Files changed por padrão: https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/
- GitHub Changelog — nova rota `/changes`: https://github.blog/changelog/2025-12-11-review-commit-by-commit-improved-filtering-and-more-in-the-pull-request-files-changed-public-preview/
- GitHub GraphQL — `markFileAsViewed`, `unmarkFileAsViewed`, `viewerViewedState`: https://docs.github.com/en/graphql/reference/pulls
- Chrome Extensions — Content Scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Chrome Extensions — Permissões: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome Web Store — Políticas de privacidade e permissões: https://developer.chrome.com/docs/webstore/program-policies/policies
