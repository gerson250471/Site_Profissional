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
      const sheet = sheetDb.getSheetByName('Visitas');
      const dados = payload.dados || {};
      
      // Calcula o período do dia
      const agora = new Date();
      const hora = agora.getHours();
      let periodo = 'Madrugada';
      if (hora >= 6 && hora < 12) periodo = 'Manhã';
      else if (hora >= 12 && hora < 18) periodo = 'Tarde';
      else if (hora >= 18 && hora <= 23) periodo = 'Noite';

      // Salva na ordem: Data_Hora | Periodo | Navegador_Dispositivo | Origem_Busca
      sheet.appendRow([
        agora, 
        periodo, 
        dados.dispositivo || 'Não identificado', 
        dados.origem || 'Acesso Direto'
      ]);
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