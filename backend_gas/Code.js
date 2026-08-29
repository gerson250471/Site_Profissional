const SPREADSHEET_ID = '1WWEP329IhjHlWrdHpCqr6PFv2H5H86BzGpqErTMk5s8';

function doGet(e) {
  const sheetDb = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. BUSCAR SERVIÇOS (KANBAN)
  const sheetServicos = sheetDb.getSheetByName('Servicos');
  const dataServicos = sheetServicos.getDataRange().getValues();
  dataServicos.shift(); 
  
  const servicos = dataServicos.map(row => ({
    id: row[0],
    cliente: row[1],
    descricao: row[2],
    status: row[3]
  }));

  // 2. BUSCAR AVALIAÇÕES MODERADAS (Novidade)
  const sheetAvaliacoes = sheetDb.getSheetByName('Avaliacoes');
  const dataAvaliacoes = sheetAvaliacoes.getDataRange().getValues();
  dataAvaliacoes.shift();
  
  const avaliacoesPublicadas = dataAvaliacoes
    .filter(row => row[4] === 'Sim') // Coluna E (Publicar) deve estar como "Sim"
    .map(row => ({
      data: row[0],
      cliente: row[1],
      nota: row[2],
      depoimento: row[3]
    }));

  // Retorna os dois pacotes de dados juntos
  return ContentService.createTextOutput(JSON.stringify({
    servicos: servicos,
    avaliacoes: avaliacoesPublicadas
  })).setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const sheetDb = SpreadsheetApp.openById(SPREADSHEET_ID);
    let result = {};

    if (action === 'registrarVisita') {
      sheetDb.getSheetByName('Visitas').appendRow([new Date()]);
      result = { status: 'sucesso' };
    }
    else if (action === 'novoContato') {
      const dados = payload.dados;
      sheetDb.getSheetByName('Contatos').appendRow([new Date(), dados.nome, dados.email, dados.mensagem, 'Novo Lead']);
      result = { status: 'sucesso' };
    }
    else if (action === 'atualizarStatusServico') {
      const sheet = sheetDb.getSheetByName('Servicos');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == payload.id_servico) {
          sheet.getRange(i + 1, 4).setValue(payload.novo_status);
          break;
        }
      }
      result = { status: 'sucesso' };
    }
    // NOVA ROTA: RECEBER AVALIAÇÃO DO CLIENTE
    else if (action === 'novaAvaliacao') {
      const sheet = sheetDb.getSheetByName('Avaliacoes');
      const dados = payload.dados;
      // Insere: Data, Cliente, Nota, Depoimento, Publicar (Padrão: Não)
      sheet.appendRow([new Date(), dados.cliente, dados.nota, dados.depoimento, 'Não']);
      result = { status: 'sucesso', mensagem: 'Avaliação enviada para moderação.' };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (erro) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'erro', mensagem: erro.message })).setMimeType(ContentService.MimeType.JSON);
  }
}