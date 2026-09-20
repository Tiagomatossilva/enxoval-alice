# Receita do carteiro (para o Júnior) 🎀

Serviço pessoal da família do Tiago (app do enxoval/cuidados da filha).
É um container Node isolado: **não toca em nada do sistema da Empresarial**,
não usa o banco, não entra no docker-compose do repositório principal.

## O que ele faz
- Recebe do aplicativo (PWA em `https://tiagomatossilva.github.io/enxoval-alice/`)
  a agenda de alarmes e dispara **Web Push** na hora certa (app fechado).
- Guarda um JSON de sincronização para os dois celulares ficarem iguais.
- Estado num volume próprio; senha da família via env `SEGREDO`.

## Subir (aprox. 10 min)
```bash
git clone https://github.com/Tiagomatossilva/enxoval-alice.git
cd enxoval-alice/carteiro
# editar docker-compose.yml: SEGREDO forte + CONTATO (e-mail qualquer válido)
docker compose up -d --build
curl -s http://127.0.0.1:8090/saude   # → {"ok":true,...}
```

## HTTPS (obrigatório)
O app roda em HTTPS (github.io), então o navegador só fala com o carteiro por HTTPS.
O bind acima é só em 127.0.0.1; exponha como preferir, por exemplo:
- um subdomínio (ex.: `alice.<dominio>.com`) com proxy reverso → `127.0.0.1:8090`
  (Caddy/Nginx/Traefik, o que já estiver de pé; se 80/443 estiverem ocupados
  pelo container do sistema, um proxy na frente de ambos resolve os dois);
- certificado Let's Encrypt normal.

Nada além de `GET/POST/PUT` em `/saude`, `/chave-publica`, `/inscrever`,
`/alarmes`, `/dados`. CORS já restrito à origem do app.

## Entregar ao Tiago
1. A URL final em HTTPS (ex.: `https://alice.dominio.com`);
2. O `SEGREDO` escolhido.
Ele cola os dois nos ajustes do app e toca em "🔔 Ativar avisos" em cada celular.

## Teste rápido de ponta a ponta
```bash
curl -s -X PUT https://SUA-URL/alarmes \
  -H 'content-type: application/json' -H 'x-segredo: SEU-SEGREDO' \
  -d '{"lista":[{"id":"teste","quando":'$(($(date +%s%3N)+30000))',"titulo":"🎀 Teste do carteiro","corpo":"funcionou!"}]}'
```
Com um celular já inscrito, a notificação chega em ~30 s.
