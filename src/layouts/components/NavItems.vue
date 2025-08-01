<script setup>
import trophy from '@/assets/images/misc/trophy.png';
import { useAdminAuth } from '@/composables/useAdminAuth';
import { currentUser } from '@/plugins/auth';
import JoinSimulationByCode from '@/views/dashboard/JoinSimulationByCode.vue';
import VerticalNavGroup from '@layouts/components/VerticalNavGroup.vue';
import VerticalNavLink from '@layouts/components/VerticalNavLink.vue';
import { computed, ref } from 'vue';

// Verificação de admin
const { isAuthorizedAdmin } = useAdminAuth();

// Para debug - sempre mostrar o menu admin temporariamente
const showAdminMenu = computed(() => {
  console.log('🔍 NavItems - Admin verification:', {
    isAuthorizedAdmin: isAuthorizedAdmin.value,
    currentUser: currentUser.value?.uid
  })
  
  // TEMPORÁRIO: sempre retornar true para testar
  return true
  
  // Versão original (comentada):
  // return isAuthorizedAdmin.value
})

const homeLink = {
  title: 'Home',
  icon: 'ri-home-5-fill',
  iconColor: '#00bcd4',
  to: '/app/dashboard',
};

const estacoesLink = {
  title: 'Estações',
  icon: 'ri-hospital-fill',
  iconColor: '#7b1fa2',
  to: '/app/station-list',
};

const grupoChatLink = {
  title: 'Grupo de Chat',
  icon: 'ri-wechat-fill',
  iconColor: '#43a047',
  to: '/app/chat-group',
};

const buscarUsuariosGroup = {
  title: 'Buscar Usuários',
  icon: 'ri-user-search-fill',
  iconColor: '#ff9800',
  to: '/app/arena/buscar-usuarios',
};

const showCodeDialog = ref(false);
function openCodeDialog() { showCodeDialog.value = true; }
function closeCodeDialog() { showCodeDialog.value = false; }

const rankingPosition = computed(() => '1º Lugar');
const rankingMeta = 98;
</script>

<template>
  <VerticalNavLink :item="homeLink" />
  <VerticalNavLink :item="estacoesLink" />
  <VerticalNavLink :item="grupoChatLink" />
  <VerticalNavLink :item="buscarUsuariosGroup" />

  <VerticalNavGroup
    :item="{
      title: 'Ranking Geral',
      icon: 'ri-medal-fill',
      iconColor: '#ffd600',
      to: '/app/ranking',
      group: false, // Remove a seta de expansão
    }"
    @click="$router.push('/app/ranking')"
    style="cursor:pointer;"
    :expandable="false"
  >
    <div class="sidebar-ranking-card d-flex align-center justify-space-between px-3 py-2">
      <div>
        <div class="text-subtitle-2 font-weight-bold mb-1">Sua posição:</div>
        <div class="text-h6" style="color: #7b1fa2; font-weight: bold;">{{ rankingPosition }}</div>
        <div class="text-caption mb-1">{{ rankingMeta }}% de aproveitamento 🚀</div>
      </div>
      <img :src="trophy" width="32" alt="Troféu" style="filter: drop-shadow(0 2px 8px #ffd600);" />
    </div>
  </VerticalNavGroup>

  <VerticalNavGroup
    :item="{
      title: 'Área do Candidato',
      icon: 'ri-user-3-fill',
      iconColor: '#1976d2',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'Progresso',
        icon: 'ri-bar-chart-fill',
        iconColor: '#00bcd4',
        to: '/candidato/progresso',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Estatísticas',
        icon: 'ri-pie-chart-2-fill',
        iconColor: '#ff9800',
        to: '/candidato/estatisticas',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Histórico',
        icon: 'ri-history-fill',
        iconColor: '#607d8b',
        to: '/candidato/historico',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Performance',
        icon: 'ri-bar-chart-grouped-fill',
        iconColor: '#43a047',
        to: '/candidato/performance',
      }"
    />
  </VerticalNavGroup>

  <VerticalNavGroup
    :item="{
      title: 'Assinatura',
      icon: 'ri-vip-crown-2-fill',
      iconColor: '#fbc02d',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'Renovação',
        icon: 'ri-refresh-fill',
        iconColor: '#00bcd4',
        to: '/assinatura/renovacao',
      }"
    />
  </VerticalNavGroup>

  <VerticalNavGroup
    :item="{
      title: 'Entrar por Código',
      icon: 'ri-key-line',
      iconColor: '#00bcd4',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'Colar Código',
        icon: 'ri-clipboard-line',
        iconColor: '#43a047',
        to: undefined,
        href: undefined,
        onClick: openCodeDialog,
      }"
    />
  </VerticalNavGroup>

  <!-- Seção Administração - Visível apenas para admins -->
  <VerticalNavGroup
    v-if="showAdminMenu"
    :item="{
      title: 'Administração',
      icon: 'ri-shield-keyhole-fill',
      iconColor: '#d32f2f',
    }"
  >
    <VerticalNavLink
      :item="{
        title: 'Painel Admin',
        icon: 'ri-dashboard-fill',
        iconColor: '#1976d2',
        to: '/app/admin',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Upload Estações',
        icon: 'ri-upload-2-fill',
        iconColor: '#388e3c',
        to: '/app/admin-upload',
      }"
    />
    <VerticalNavLink
      :item="{
        title: 'Reset Usuários',
        icon: 'ri-refresh-fill',
        iconColor: '#f57c00',
        to: '/app/admin-reset-users',
      }"
    />
  </VerticalNavGroup>

  <VDialog v-model="showCodeDialog" max-width="400">
    <VCard>
      <VCardTitle class="text-h6">Entrar por Código</VCardTitle>
      <VCardText>
        <JoinSimulationByCode />
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn color="primary" text @click="closeCodeDialog">Fechar</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
