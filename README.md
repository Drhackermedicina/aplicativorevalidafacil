<<<<<<< HEAD
# Diário de Desenvolvimento — Materio Vuetify VueJS Admin

Este arquivo serve como diário de bordo do projeto.  
**Todas as tarefas, decisões e alterações devem ser registradas aqui.**
Sabendo que estou desenvolvendo um app, você é um programador sênior e está me ensinando a implementar componentes novos, novos códigos e me ajudando no desenvolvimento e integração do meu projeto. Sempre buscando a eficácia, investigando muito antes de fazer qualquer alteração no projeto, e tentando melhorar o projeto continuamente.
Sempre que você receber um comando ou for me auxiliar, tenha como norte esta orientação e **leia atentamente o arquivo "readme.me" e o "dev_reference.txt"** do projeto.

**IMPORTANTE:** A cada vez que você acessar ou modificar um arquivo ou pasta existente, ou criar um novo arquivo ou pasta, **adicione o caminho completo desse arquivo/pasta ao final do arquivo "dev_reference.txt"**, indicando se foi acessado, modificado ou criado.

---

**A seguir, listo os objetivos que o meu aplicativo tem e seus principais componentes. Alguns já estão prontos e outros serão integrados nesse projeto baseado em códigos que já tenho pronto:**

## README - Meu Primeiro App Vue

## Finalidade e Proposta

Este aplicativo tem como objetivo principal auxiliar candidatos do REVALIDA (Exame Nacional de Revalidação de Diplomas Médicos) a treinarem e simularem estações clínicas, além de promover interação, análise de desempenho e ranking entre usuários. O sistema centraliza diferentes bancos de estações (REVALIDA FÁCIL, INEP, Medway, etc.), agrupando por especialidade médica e origem, permitindo fácil acesso e navegação.

## Contexto Atual do Projeto e Integração

Estou atualmente no processo de **integrar este projeto Vue.js existente em um novo projeto Vue.js que utiliza o framework Vuetify Materio**. Baixei o código completo do tema Materio e os arquivos `.vue` listados abaixo (HomePage.vue, StationList.vue, etc.) do projeto antigo **ainda não foram aplicados ou adaptados** ao novo ambiente Vuetify Materio.

Minha principal necessidade agora é entender e receber propostas sobre **como fazer a integração desses componentes e da lógica existente do projeto antigo para o novo projeto baseado em Vuetify Materio**, garantindo a compatibilidade e aproveitando os recursos do Materio.

## Funcionalidades Principais

- **Página Home (/home):**
  - Exibe estatísticas do usuário (simulações concluídas, pontuação média, sequência atual, estações disponíveis).
  - Mostra estações agrupadas por especialidade médica, com acesso rápido às simulações.
  - Lista usuários online e seus status.
  - Ações rápidas para iniciar simulação, ver ranking, desempenho e chat.

- **Página de Estações (/stations):**
  - Lista todas as estações disponíveis, filtrando por especialidade, origem, dificuldade, etc.
  - Permite iniciar simulação de qualquer estação.

- **Página de Ranking (/ranking):**
  - Exibe a posição do usuário em relação aos demais, com base em critérios como simulações realizadas, pontuação e streak.

- **Página de Desempenho (/performance):**
  - Mostra análise detalhada do progresso do usuário, gráficos e estatísticas.

- **Página de Chat (/chat):**
  - Permite encontrar parceiros para simulação e trocar mensagens.

- **Administração:**
  - Upload de novas estações, edição e categorização (restrito a administradores).

## Funcionalidades Detalhadas por Componente

### HomePage.vue (/home)

- Carrega e agrupa estações por especialidade e origem (Firestore/Firebase).
- Exibe estatísticas do usuário (simulações, média, streak, estações disponíveis).
- Lista usuários online e seus status.
- Ações rápidas para simulação, ranking, desempenho e chat.
- Funções principais:
  - `loadStations()`: Busca e normaliza todas as estações do banco de dados.
  - Agrupamento dinâmico por especialidade e origem.
  - Debug detalhado de estações do REVALIDA FÁCIL.

### StationList.vue (/stations)

- Lista todas as estações disponíveis, com filtros por especialidade, origem, busca e sugestões.
- Permite iniciar simulação, editar estação (admin), copiar link e abrir modal de detalhes.
- Funções principais:
  - `getCleanStationTitle`, `getStationArea`, `getAreaName`, `filteredRevalidaFacilByArea`, `filterStationsBySearch`, `updateSuggestions`, `selectSuggestion`, `hideSuggestions`, `loadStations`, `createSession`, `editStation`, `closeModal`, `copyLink`, `openSimulation`.

### RankingView.vue (/ranking)

- Exibe ranking dos usuários baseado em simulações, pontuação e streak.

### PerformanceView.vue (/performance)

- Mostra análise detalhada do progresso do usuário, gráficos e estatísticas.

### ChatView.vue (/chat)

- Permite encontrar parceiros para simulação e trocar mensagens.

### AdminUpload.vue

- Upload de novas estações (JSON), validação, edição e envio para o banco.
- Funções para manipulação de formulários, arquivos, validação e upload em lote.

### AdminView.vue

- Painel administrativo para gerenciar estações, usuários e permissões.

### EditStationView.vue

- Edição avançada de estações, campos dinâmicos, limpeza e adaptação de dados.

### SimulationView.vue

- Simulação interativa de estações, timer, chat, avaliação, envio de dados e integração com WebSocket.
- Funções para formatação, timer, avaliação, manipulação de sessão e interação com o parceiro.

---

## 📅 Histórico de Tarefas e Alterações

### [26/06/2025]

- Estruturado arquivo DEV_REFERENCE.txt com guia de pastas e organização do projeto.
- Definido padrão para registro de tarefas e alterações neste README.
- Instruído para sempre consultar o DEV_REFERENCE.txt antes de qualquer alteração ou implementação.
- Iniciado processo de customização do sidebar (menu lateral).

---

## Como usar este README

- Após cada alteração, registre aqui:
  - Data
  - Descrição da tarefa/alteração
  - Decisões importantes
- Use este arquivo como referência para o histórico do projeto e para onboarding de novos desenvolvedores.

---

## Padrão de Organização

- Consulte sempre o arquivo `DEV_REFERENCE.txt` antes de criar ou alterar qualquer coisa.
- Siga o padrão do tema Materio Vuetify para componentes, layouts e estilos.
- Mantenha este README sempre atualizado.

---

## vue

Este template deve ajudar você a começar o desenvolvimento com Vue 3 em Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) (e desabilite o Vetur).

## Type Support for `.vue` Imports in TS

Como o TypeScript não consegue lidar com informações de tipo para imports `.vue`, eles são tratados como componentes Vue genéricos por padrão. Na maioria dos casos isso é suficiente, a menos que você queira validação de props fora dos templates.

Se quiser obter os tipos reais de props em imports `.vue` (por exemplo, para validação de props ao usar chamadas manuais de `h(...)`), execute `Volar: Switch TS Plugin on/off` no palette de comandos do VS Code.

## Customize configuration

Veja [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```
=======
# aplicativorevalidafacil
>>>>>>> 1d0090a4b085d7ed16c4995bc78f7db8b44cc236
