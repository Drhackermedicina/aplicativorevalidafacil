// Script de teste para verificar se o sistema de avaliação está funcionando
// Execute este script no console do navegador enquanto estiver logado

console.log('🔍 Testando sistema de avaliação...');

// Função de teste para verificar as permissões
async function testEvaluationPermissions() {
  const { db } = await import('./src/plugins/firebase.js');
  const { doc, getDoc, updateDoc } = await import('firebase/firestore');
  
  try {
    console.log('📋 Verificando permissões do Firestore...');
    
    // ID do candidato que foi identificado nos logs
    const candidateUID = 'lNwhdYgMwLhS1ZyufRzw9xLD10y1';
    const userRef = doc(db, 'usuarios', candidateUID);
    
    // Tentar ler o documento do candidato
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      console.log('✅ Leitura do candidato funcionando');
      console.log('📊 Dados do candidato:', {
        nome: userSnap.data().displayName,
        email: userSnap.data().email,
        estatisticas: userSnap.data().statistics,
        nivelHabilidade: userSnap.data().nivelHabilidade
      });
    } else {
      console.log('❌ Candidato não encontrado');
      return;
    }
    
    // Tentar atualizar um campo de teste (se for permitido)
    try {
      await updateDoc(userRef, {
        lastTestTime: new Date().toISOString()
      });
      console.log('✅ Escrita no documento do candidato funcionando');
    } catch (writeError) {
      console.log('❌ Erro na escrita:', writeError.message);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Função para testar o serviço de avaliação
async function testEvaluationService() {
  try {
    console.log('🎯 Testando serviço de avaliação...');
    
    const { registrarConclusaoEstacao } = await import('./src/services/stationEvaluationService.js');
    
    // Parâmetros de teste
    const testParams = {
      uid: 'lNwhdYgMwLhS1ZyufRzw9xLD10y1', // UID do candidato identificado
      idEstacao: 'test-station-001', // ID de uma estação de teste
      nota: 8.5,
      data: new Date(),
      useTransaction: false // Usar método simples primeiro
    };
    
    console.log('📤 Enviando avaliação de teste:', testParams);
    
    const result = await registrarConclusaoEstacao(testParams);
    
    if (result) {
      console.log('✅ Avaliação registrada com sucesso!');
      console.log('🎉 Sistema de avaliação está funcionando corretamente');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste do serviço:', error);
    
    if (error.message.includes('permission')) {
      console.log('🔒 Erro de permissão detectado - verificando regras do Firestore...');
    }
  }
}

console.log('🚀 Para executar os testes, use:');
console.log('testEvaluationPermissions() - Testa permissões básicas');
console.log('testEvaluationService() - Testa o serviço completo de avaliação');

// Exportar para uso global
window.testEvaluationPermissions = testEvaluationPermissions;
window.testEvaluationService = testEvaluationService;
