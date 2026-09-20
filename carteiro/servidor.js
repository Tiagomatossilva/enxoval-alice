/* Carteiro do Enxoval da Alice
   Serviço minúsculo e independente: guarda os alarmes agendados pelo app,
   dispara notificações (Web Push) na hora certa e sincroniza os registros
   entre os celulares da família. Nada aqui toca qualquer outro sistema. */

const http = require('http');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const PORTA = Number(process.env.PORTA || 8090);
const SEGREDO = process.env.SEGREDO || '';
const ORIGEM = process.env.ORIGEM || 'https://tiagomatossilva.github.io';
const CONTATO = process.env.CONTATO || 'mailto:carteiro@example.com';
const ARQ = path.join(process.env.DADOS_DIR || '/dados', 'carteiro.json');

if (!SEGREDO) {
  console.error('Defina a variável SEGREDO (a senha da família) antes de subir.');
  process.exit(1);
}

let estado = { vapid: null, inscricoes: [], alarmes: [], dados: null };
try { estado = Object.assign(estado, JSON.parse(fs.readFileSync(ARQ, 'utf8'))); } catch (e) {}
function gravar() {
  try {
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(estado));
  } catch (e) { console.error('não consegui gravar o estado:', e.message); }
}
if (!estado.vapid) { estado.vapid = webpush.generateVAPIDKeys(); gravar(); }
webpush.setVapidDetails(CONTATO, estado.vapid.publicKey, estado.vapid.privateKey);

function corpoJson(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (peca) => {
      dados += peca;
      if (dados.length > 2 * 1024 * 1024) { reject(new Error('grande demais')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(dados ? JSON.parse(dados) : {}); } catch (e) { reject(new Error('json inválido')); }
    });
    req.on('error', reject);
  });
}
function responder(res, codigo, obj) {
  const corpo = JSON.stringify(obj === undefined ? { ok: true } : obj);
  res.writeHead(codigo, { 'content-type': 'application/json' });
  res.end(corpo);
}

const servidor = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGEM);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-segredo');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = (req.url || '/').split('?')[0];
  if (url === '/saude') { responder(res, 200, { ok: true, alarmes: estado.alarmes.length, aparelhos: estado.inscricoes.length }); return; }
  if ((req.headers['x-segredo'] || '') !== SEGREDO) { responder(res, 401, { erro: 'senha errada' }); return; }

  try {
    if (url === '/chave-publica' && req.method === 'GET') {
      responder(res, 200, { chave: estado.vapid.publicKey });
    } else if (url === '/inscrever' && req.method === 'POST') {
      const { inscricao } = await corpoJson(req);
      if (!inscricao || !inscricao.endpoint) { responder(res, 400, { erro: 'inscrição inválida' }); return; }
      estado.inscricoes = estado.inscricoes.filter(i => i.endpoint !== inscricao.endpoint);
      estado.inscricoes.push(inscricao);
      gravar();
      responder(res, 200);
    } else if (url === '/alarmes' && req.method === 'PUT') {
      const { lista } = await corpoJson(req);
      estado.alarmes = (Array.isArray(lista) ? lista : [])
        .filter(a => a && a.id && Number(a.quando) > 0)
        .map(a => ({ id: String(a.id), quando: Number(a.quando), titulo: String(a.titulo || 'Alice 👶'), corpo: String(a.corpo || '') }));
      gravar();
      responder(res, 200, { agendados: estado.alarmes.length });
    } else if (url === '/dados' && req.method === 'GET') {
      responder(res, 200, estado.dados || {});
    } else if (url === '/dados' && req.method === 'PUT') {
      estado.dados = await corpoJson(req);
      gravar();
      responder(res, 200);
    } else {
      responder(res, 404, { erro: 'não existe' });
    }
  } catch (e) {
    responder(res, 400, { erro: e.message });
  }
});

async function dispararVencidos() {
  const agora = Date.now();
  const vencidos = estado.alarmes.filter(a => a.quando <= agora);
  if (!vencidos.length) return;
  estado.alarmes = estado.alarmes.filter(a => a.quando > agora);
  gravar();
  for (const alarme of vencidos) {
    const mensagem = JSON.stringify({ titulo: alarme.titulo, corpo: alarme.corpo });
    for (const inscricao of estado.inscricoes.slice()) {
      try {
        await webpush.sendNotification(inscricao, mensagem);
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          estado.inscricoes = estado.inscricoes.filter(i => i.endpoint !== inscricao.endpoint);
          gravar();
        }
      }
    }
    console.log(new Date().toISOString(), 'disparado:', alarme.id, alarme.titulo);
  }
}
setInterval(() => { dispararVencidos().catch(() => {}); }, 20000);

servidor.listen(PORTA, () => console.log('Carteiro da Alice de pé na porta ' + PORTA));
