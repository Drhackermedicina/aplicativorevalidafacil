# Instruções para o Gemini no Projeto Materio Admin

## 1. Visão Geral do Projeto

Este é um painel de administração (admin dashboard) para a aplicação "Revalida Fácil". O projeto é baseado no template Materio Vuetify VueJS Free. O objetivo é gerenciar estações, usuários e conteúdo da plataforma.

## 2. Tecnologias Utilizadas

- **Frontend:** Vue.js 3 (usando Composition API), Vuetify 3, Vite.
- **Gerenciador de Estado:** Pinia.
- **Roteamento:** Vue Router.
- **Estilo:** Siga as convenções do Vuetify e as classes de utilidade existentes. Não introduza novas bibliotecas de CSS sem permissão.
- **Backend:** Existe uma pasta `backend/` com um servidor Node.js/Express.

## 3. Comandos Comuns

- **Iniciar desenvolvimento:** `npm run dev`
- **Construir para produção (geral):** `npm run build`
- **Construir para Revalida Fácil App:** `npm run build:revalidafacilapp`
- **Visualizar build:** `npm run preview`
- **Linter (verificar e corrigir código):** `npm run lint`

## 4. Convenções de Código

- **Componentes Vue:** Sempre use a tag `<script setup>` (Composition API) para novos componentes.
- **Nomenclatura:**
    - Componentes: `PascalCase` (ex: `MeuComponente.vue`).
    - Arquivos de serviço/utilitários: `camelCase` (ex: `authService.js`).
- **Estrutura de Diretórios:**
    - **Páginas completas:** `src/pages`
    - **Componentes reutilizáveis:** `src/components`
    - **Layouts de página:** `src/layouts`
    - **Lógica de API/serviços:** `src/services`
    - **Stores (Pinia):** `src/stores`

## 5. O que NÃO fazer

- Não altere arquivos de configuração (`vite.config.js`, `package.json`, `.eslintrc.cjs`) sem discutir primeiro.
- Não use a Options API do Vue; prefira sempre a Composition API.
- Não instale novas dependências sem necessidade. Use as que já estão no projeto (`axios` para HTTP, `pinia` para estado, etc.).
