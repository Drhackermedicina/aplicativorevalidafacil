<template>
  <div class="admin-view">
    <div class="container">
      <h1>Administração</h1>
      <p>Painel de administração em desenvolvimento...</p>
      <div class="admin-actions">
        <button @click="$router.push('/admin/upload')" class="btn btn-primary">
          Fazer Upload de Arquivo
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdminView'
}
</script>

<style scoped>
.admin-view {
  min-block-size: 100vh;
  padding-block: 20px;
  padding-inline: 20px;
  background-color: white;
}

.container {
  max-inline-size: 1200px;
  margin-inline: auto;
  padding-block: 0;
  padding-inline: 20px;
}

.admin-actions {
  margin-block-start: 20px;
}

.btn {
  padding-block: 10px;
  padding-inline: 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  margin-inline-end: 10px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.dark-theme .admin-view {
  background-color: #1a1a1a;
  color: white;
}

.dark-theme .btn-primary {
  background-color: #0d6efd;
}

.dark-theme .btn-primary:hover {
  background-color: #0b5ed7;
}
</style>
