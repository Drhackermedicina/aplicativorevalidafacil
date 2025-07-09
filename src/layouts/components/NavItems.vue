<script setup>
import VerticalNavGroup from '@layouts/components/VerticalNavGroup.vue';
import VerticalNavLink from '@layouts/components/VerticalNavLink.vue';

// Substitui o grupo por um link único para Estações
const estacoesLink = {
  title: 'Estações',
  icon: 'ri-hospital-line',
  to: '/app/station-list',
};
</script>

<template>
  <!-- ESTAÇÕES -->
  <VerticalNavLink :item="estacoesLink" />

  <!-- ARENA -->
  <VerticalNavGroup
    :item="{
      title: 'ARENA',
      icon: 'ri-sword-line',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'Chat',
        icon: 'ri-wechat-line',
        to: '/app/arena/chat',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Buscar Usuários',
        icon: 'ri-search-line',
        to: '/app/arena/buscar-usuarios',
        disabled: true // Desativado temporariamente
      }"
    />
  </VerticalNavGroup>

  <!-- Área do Candidato -->
  <VerticalNavGroup
    :item="{
      title: 'Área do Candidato',
      icon: 'ri-user-line',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'Progresso',
        icon: 'ri-bar-chart-line',
        to: '/candidato/progresso',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Estatísticas',
        icon: 'ri-pie-chart-line',
        to: '/candidato/estatisticas',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Ranking',
        icon: 'ri-trophy-line',
        to: '/candidato/ranking',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Histórico',
        icon: 'ri-history-line',
        to: '/candidato/historico',
      }"
    />
  </VerticalNavGroup>

  <!-- Assinatura -->
  <VerticalNavGroup
    :item="{
      title: 'Assinatura',
      icon: 'ri-vip-crown-line',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'Renovação',
        icon: 'ri-refresh-line',
        to: '/assinatura/renovacao',
      }"
    />
  </VerticalNavGroup>
</template>
