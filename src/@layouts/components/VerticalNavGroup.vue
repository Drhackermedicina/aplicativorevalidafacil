<script setup>
const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const isOpen = ref(false)
</script>

<template>
  <li
    class="nav-group"
    :class="isOpen && 'open'"
  >
    <div
      class="nav-group-label"
      @click="isOpen = !isOpen"
    >
      <VTooltip location="right">
        <template #activator="{ props }">
          <VIcon
            v-bind="props"
            :icon="item.icon || 'ri-checkbox-blank-circle-line'"
            class="nav-item-icon"
            :color="item.iconColor || undefined"
          />
        </template>
        {{ item.title }}
      </VTooltip>
      <span class="nav-item-title">{{ item.title }}</span>
      <span
        class="nav-item-badge"
        :class="item.badgeClass"
      >
        {{ item.badgeContent }}
      </span>
      <VIcon
        icon="ri-arrow-right-s-line"
        class="nav-group-arrow"
      />
    </div>
    <div class="nav-group-children-wrapper">
      <ul class="nav-group-children">
        <slot />
      </ul>
    </div>
  </li>
</template>

<style lang="scss">
.layout-vertical-nav {
  .nav-group {
    &-label {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .nav-group-children-wrapper {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.3s ease-in-out;

      .nav-group-children {
        overflow: hidden;
      }
    }

    &.open {
      .nav-group-children-wrapper {
        grid-template-rows: 1fr;
      }
    }
  }
}
</style>
