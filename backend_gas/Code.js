const SPREADSHEET_ID = '1WWEP329IhjHlWrdHpCqr6PFv2H5H86BzGpqErTMk5s8';
const FUSO = 'America/Sao_Paulo';
const BASE = ['Evento_ID','Data_Hora_SP','Sessao_ID','Evento','Teste','Sinal_Automacao','Origem_Declarada','utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','Referencia','Pagina','Navegador','Posicao'];
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function texto_(value, max) { return typeof value === 'string' ? value.trim().slice(0, max || 500) : ''; }
function celula_(value) { return typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? "'" + value : value; }
function tabela_(db, name, headers) {
  const sheet = db.getSheetByName(name) || db.insertSheet(name);
  if (sheet.getLastRow() === 0) { sheet.appendRow(headers); sheet.setFrozenRows(1); }
  const actual = sheet.getRange(1,1,1,headers.length).getValues()[0];
  if (actual.join('|') !== headers.join('|')) throw new Error('Estrutura incompatível: ' + name);
  return sheet;
}
function existe_(sheet, id) {
  return sheet.getLastRow() > 1 && !!sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).useRegularExpression(false).findNext();
}
function classificar_(source) {
  if (source.gclid || source.gbraid || source.wbraid) return 'Identificador Google presente — não verificado';
  if (source.utm_source && source.utm_medium) return 'UTM declarada';
  if (source.utm_source || source.utm_medium || source.utm_campaign || source.utm_term || source.utm_content) return 'UTM incompleta';
  if (source.referrer) return 'Referência de site';
  return 'Origem não identificada';
}
function base_(p, evento) {
  const s = p.origem || {};
  const ua = texto_(p.navegador,1000);
  const robot = /bot|crawler|spider|headless|google-read-aloud|PTST\/|pageburst/i.test(ua) ? 'Indício no navegador' : 'Não identificado';
  return [p.event_id, Utilities.formatDate(new Date(),FUSO,'yyyy-MM-dd HH:mm:ss'),p.session_id,evento,p.teste === true ? 'Sim' : 'Não',robot,classificar_(s),
    ...['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','referrer','page'].map(k => texto_(s[k],500)),ua,texto_(p.posicao,80)].map(celula_);
}
function doPost(e) {
  let lock;
  try {
    if (!e || !e.postData || e.postData.contents.length > 20000) throw new Error('Requisição inválida');
    const p = JSON.parse(e.postData.contents);
    // Transição: versões antigas continuam nas abas antigas, fora da medição v2.
    if (['registrarVisita','novoContato','novaAvaliacao'].includes(p.action)) return legado_(p);
    if (!['eventoV2','contatoV2'].includes(p.action)) throw new Error('Ação inválida');
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(p.event_id || '') || !/^[a-zA-Z0-9-]{16,80}$/.test(p.session_id || '')) throw new Error('Identificador inválido');
    let values, headers = BASE, name = 'Eventos_v2';
    if (p.action === 'contatoV2') {
      const d = p.dados || {};
      const nome = texto_(d.nome,120), email = texto_(d.email,254), mensagem = texto_(d.mensagem,5000);
      if (d.website || nome.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || mensagem.length < 5) throw new Error('Confira os campos do formulário');
      name = 'Contatos_v2'; headers = BASE.concat(['Nome','Email','Mensagem','Status_Comercial']);
      values = base_(p,'contato_recebido').concat([nome,email,mensagem,'Novo'].map(celula_));
    } else {
      if (!['visita','clique_whatsapp','clique_email','inicio_formulario'].includes(p.evento)) throw new Error('Evento inválido');
      values = base_(p,p.evento);
    }
    lock = LockService.getScriptLock(); lock.waitLock(15000);
    const db = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = tabela_(db,name,headers);
    const duplicate = existe_(sheet,p.event_id);
    if (!duplicate) sheet.appendRow(values);
    SpreadsheetApp.flush();
    return json_({ status:'sucesso',event_id:p.event_id,duplicado:duplicate });
  } catch (err) {
    console.error(err);
    return json_({ status:'erro',mensagem:'Não foi possível confirmar a gravação.' });
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
function legado_(p) {
  const db = SpreadsheetApp.openById(SPREADSHEET_ID), d = p.dados || {};
  let name, row;
  if (p.action === 'registrarVisita') {
    const now = new Date(), hour = Number(Utilities.formatDate(now,FUSO,'H'));
    const period = hour < 6 ? 'Madrugada' : hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite';
    name = 'Visitas'; row = [now,period,texto_(d.dispositivo,1000),texto_(d.origem),texto_(d.localizacao)];
  } else if (p.action === 'novoContato') {
    if (!texto_(d.nome) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto_(d.email)) || !texto_(d.mensagem)) throw new Error('Contato inválido');
    name = 'Contatos'; row = [new Date(),texto_(d.nome,120),texto_(d.email,254),texto_(d.mensagem,5000),'Novo'];
  } else {
    if (!texto_(d.cliente) || !Number.isInteger(Number(d.nota)) || Number(d.nota)<1 || Number(d.nota)>5 || !texto_(d.depoimento)) throw new Error('Avaliação inválida');
    name = 'Avaliacoes'; row = [new Date(),texto_(d.cliente,120),Number(d.nota),texto_(d.depoimento,5000),'Não'];
  }
  const sheet = db.getSheetByName(name);
  if (!sheet) throw new Error('Aba ausente');
  sheet.appendRow(row.map(celula_));
  return json_({status:'sucesso'});
}
// Mantém a consulta de serviços e avaliações moderadas do código anterior.
// Nunca expõe contatos ou eventos pelo GET público.
function doGet() {
  try {
    const db = SpreadsheetApp.openById(SPREADSHEET_ID);
    const rows = name => { const s = db.getSheetByName(name); return s && s.getLastRow()>1 ? s.getDataRange().getValues().slice(1) : []; };
    return json_({
      servicos: rows('Servicos').map(r => ({id:r[0],cliente:r[1],descricao:r[2],status:r[3]})),
      avaliacoes: rows('Avaliacoes').filter(r => r[4] === 'Sim').map(r => ({data:r[0],cliente:r[1],nota:r[2],depoimento:r[3]}))
    });
  } catch (err) { return json_({status:'erro'}); }
}
