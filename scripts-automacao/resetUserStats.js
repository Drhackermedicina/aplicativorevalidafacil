/**
 * Script para resetar estatísticas e status de todos os usuários
 * Execute com: node scripts-automacao/resetUserStats.js
 */

const admin = require('firebase-admin');

// Configuração do Firebase Admin
const serviceAccount = require('../revalida-companion-firebase-adminsdk.json'); // Você precisa baixar este arquivo

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://revalida-companion-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

async function resetAllUserStats() {
  try {
    console.log('🚀 Iniciando reset de estatísticas dos usuários...');
    
    // 1. Buscar todos os usuários
    const usersSnapshot = await db.collection('usuarios').get();
    console.log(`📊 Encontrados ${usersSnapshot.size} usuários`);
    
    // 2. Preparar dados para reset
    const resetData = {
      status: 'offline',
      
      // Estatísticas de estações
      estatisticas: {
        totalEstacoesFeitas: 0,
        estacoesPorEspecialidade: {},
        mediaGeral: 0,
        melhorNota: 0,
        piorNota: 0,
        tempoTotalTreinamento: 0,
        ultimaAtividade: null,
        progressoSemanal: [],
        rankingPosicao: null
      },
      
      // Reset de progresso
      progresso: {
        nivelAtual: 'Iniciante',
        pontosExperiencia: 0,
        conquistas: [],
        metasSemana: {
          estacoesPlanejadas: 0,
          estacoesRealizadas: 0,
          progresso: 0
        }
      },
      
      // Limpar histórico de simulações
      historicoSimulacoes: [],
      
      // Reset de configurações que podem afetar stats
      ultimoLogin: admin.firestore.FieldValue.serverTimestamp(),
      dataUltimaAtualizacao: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // 3. Atualizar usuários em lotes
    const batch = db.batch();
    let processedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userRef = db.collection('usuarios').doc(userDoc.id);
      
      // Manter dados essenciais do usuário (não resetar dados pessoais)
      const currentData = userDoc.data();
      const preservedData = {
        uid: currentData.uid,
        email: currentData.email,
        nome: currentData.nome,
        sobrenome: currentData.sobrenome,
        displayName: currentData.displayName,
        photoURL: currentData.photoURL,
        telefone: currentData.telefone,
        dataCadastro: currentData.dataCadastro,
        emailVerified: currentData.emailVerified,
        // Preservar role/permissions se existir
        role: currentData.role,
        permissions: currentData.permissions
      };
      
      // Combinar dados preservados com reset
      const finalData = { ...preservedData, ...resetData };
      
      batch.update(userRef, finalData);
      processedCount++;
      
      if (processedCount % 100 === 0) {
        console.log(`📝 Processados ${processedCount}/${usersSnapshot.size} usuários`);
      }
    }
    
    // 4. Executar batch update
    await batch.commit();
    console.log('✅ Reset concluído no Firestore!');
    
    // 5. Reset no backend (Railway)
    console.log('🔄 Enviando reset para o backend...');
    await resetBackendStats();
    
    console.log('🎉 Reset completo realizado com sucesso!');
    console.log(`📊 Total de usuários resetados: ${processedCount}`);
    
  } catch (error) {
    console.error('❌ Erro durante o reset:', error);
  }
}

async function resetBackendStats() {
  try {
    const response = await fetch('https://backendraiway-production.up.railway.app/api/admin/reset-all-user-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_ADMIN_TOKEN' // Configure um token de admin
      },
      body: JSON.stringify({
        resetType: 'complete',
        timestamp: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      console.log('✅ Backend resetado com sucesso!');
    } else {
      console.log('⚠️ Erro no reset do backend:', await response.text());
    }
  } catch (error) {
    console.log('⚠️ Não foi possível conectar ao backend:', error.message);
  }
}

// Função para resetar apenas estatísticas específicas
async function resetSpecificStats(resetOptions = {}) {
  const {
    resetStatus = true,
    resetEstacoes = true,
    resetNotas = true,
    resetTempo = true,
    resetConquistas = true
  } = resetOptions;
  
  try {
    console.log('🎯 Iniciando reset seletivo...');
    
    const usersSnapshot = await db.collection('usuarios').get();
    const batch = db.batch();
    
    for (const userDoc of usersSnapshot.docs) {
      const userRef = db.collection('usuarios').doc(userDoc.id);
      const updateData = {};
      
      if (resetStatus) {
        updateData.status = 'offline';
      }
      
      if (resetEstacoes) {
        updateData['estatisticas.totalEstacoesFeitas'] = 0;
        updateData['estatisticas.estacoesPorEspecialidade'] = {};
      }
      
      if (resetNotas) {
        updateData['estatisticas.mediaGeral'] = 0;
        updateData['estatisticas.melhorNota'] = 0;
        updateData['estatisticas.piorNota'] = 0;
      }
      
      if (resetTempo) {
        updateData['estatisticas.tempoTotalTreinamento'] = 0;
      }
      
      if (resetConquistas) {
        updateData['progresso.conquistas'] = [];
        updateData['progresso.pontosExperiencia'] = 0;
      }
      
      batch.update(userRef, updateData);
    }
    
    await batch.commit();
    console.log('✅ Reset seletivo concluído!');
    
  } catch (error) {
    console.error('❌ Erro no reset seletivo:', error);
  }
}

// Executar script
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--selective')) {
    // Reset seletivo
    const options = {
      resetStatus: args.includes('--status'),
      resetEstacoes: args.includes('--estacoes'),
      resetNotas: args.includes('--notas'),
      resetTempo: args.includes('--tempo'),
      resetConquistas: args.includes('--conquistas')
    };
    
    await resetSpecificStats(options);
  } else {
    // Reset completo
    const confirm = args.includes('--confirm');
    
    if (!confirm) {
      console.log('⚠️  ATENÇÃO: Este script vai resetar TODAS as estatísticas de TODOS os usuários!');
      console.log('');
      console.log('Para confirmar, execute com: node resetUserStats.js --confirm');
      console.log('');
      console.log('Para reset seletivo, use:');
      console.log('node resetUserStats.js --selective --status --estacoes --notas');
      return;
    }
    
    await resetAllUserStats();
  }
  
  process.exit(0);
}

main().catch(console.error);
