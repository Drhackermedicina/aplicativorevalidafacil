<template>
  <!-- O v-app é o container raiz de toda a aplicação Vuetify -->
  <v-app>
    <!-- RouterView é onde os componentes das suas rotas (páginas) serão renderizados -->
    <RouterView />

    <!-- Aqui incluímos o componente personalizador. -->
    <!-- Ele será exibido em todas as páginas da sua aplicação. -->
    <ThemeCustomizer />
  </v-app>
</template>

<script setup>
// Importa o RouterView para gerenciar as rotas da aplicação
import { RouterView } from 'vue-router'

// Importa o componente que acabamos de criar.
// O caminho './components/ThemeCustomizer.vue' assume que App.vue está em 'src'
// e ThemeCustomizer.vue está em 'src/components'.
import ThemeCustomizer from './components/ThemeCustomizer.vue'
</script>

<style>
/* Estilos globais podem ser adicionados aqui */
</style>
