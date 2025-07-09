<template>
  <div class="performance-view">
    <div class="container">
      <h1>Performance</h1>
      <p>Análise de performance do sistema em desenvolvimento...</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PerformanceView'
}
</script>

<style scoped>
.performance-view {
  padding: 20px;
  min-height: 100vh;
  background-color: white;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.dark-theme .performance-view {
  background-color: #1a1a1a;
  color: white;
}
</style>
