<template>
  <v-card class="pa-4" outlined>
    <v-card-title>Demo TensorFlow.js no Vue + Vuetify</v-card-title>
    <v-card-text>
      <div>Entrada: {{ inputArray.join(', ') }}</div>
      <v-btn color="primary" class="my-2" @click="runModel">Rodar Modelo (elevar ao quadrado)</v-btn>
      <div v-if="result.length">Resultado: {{ result.join(', ') }}</div>
    </v-card-text>
  </v-card>
</template>

<script>
import * as tf from '@tensorflow/tfjs';

export default {
  name: 'TensorFlowDemo',
  data() {
    return {
      inputArray: [1, 2, 3, 4],
      result: []
    };
  },
  methods: {
    runModel() {
      const tensor = tf.tensor(this.inputArray);
      const squared = tensor.square();
      this.result = Array.from(squared.dataSync());
    }
  }
};
</script>

<style scoped>
.v-card {
  margin-block: 40px;
  margin-inline: auto;
  max-inline-size: 400px;
}
</style>
