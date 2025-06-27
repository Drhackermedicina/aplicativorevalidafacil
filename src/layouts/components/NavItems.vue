<script setup>
import VerticalNavGroup from '@layouts/components/VerticalNavGroup.vue';
import VerticalNavLink from '@layouts/components/VerticalNavLink.vue';
</script>

<template>
  <!-- ESTAÇÕES -->
  <VerticalNavGroup
    :item="{
      title: 'ESTAÇÕES',
      icon: 'ri-map-pin-line',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'REVALIDA FÁCIL',
        icon: 'ri-graduation-cap-line',
        to: '/revalida-facil',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'INEP',
        icon: 'ri-government-line',
        to: '/inep',
      }"
    />
  </VerticalNavGroup>

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
        to: '/arena/chat',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Buscar Usuários',
        icon: 'ri-search-line',
        to: '/arena/buscar-usuarios',
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
