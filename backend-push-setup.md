# Implementacao do Web Push com Backend Node.js
Como o sistema BatCheckout atual e mantido integralmente em pure-frontend e localStorage para ambientes de prototipagem rapida e zero dependencias, este guia fornece a rotina oficial exata de Back-end caso deseje converte-lo posteriormente para um servidor Node (Express) com suporte autentico Web Push e Apple/Google Subscriptions.

## 1. Instalacao e Parametros VAPID
Inicialize o seu projeto backend e instale a biblioteca web-push.
\`\`\`bash
npm install express body-parser web-push cors dotenv
npx web-push generate-vapid-keys
\`\`\`

Isso vai gerar e cuspir duas chaves no terminal (Public Key e Private Key). Guarde em seu '.env':
\`\`\`env
VAPID_PUBLIC_KEY=SUA_CHAVE_PUBLICA
VAPID_PRIVATE_KEY=SUA_CHAVE_PRIVADA
VAPID_SUBJECT=mailto:suporte@batcheckout.com
\`\`\`

## 2. Server Node.js (server.js)

\`\`\`javascript
require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Banco de dados de inscricoes (Exemplo em memoria)
const subscriptions = [];

// Endpoint para Cadastrar Inscricao Push
app.post('/push/subscribe', (req, res) => {
    const { subscription, userId } = req.body;
    subscriptions.push({ subscription, userId });
    res.status(201).json({});
});

// Exemplo da Rota que capta o Pagamento Aprovado e Forca Notificacao
app.post('/webhook/payment', (req, res) => {
    const payload = req.body; 
    
    const notificationPayload = JSON.stringify({
        title: payload.status === 'approved' ? 'Venda Paid!' : 'Pix Gerado!',
        body: 'Nova atualizacao de transacao para o cliente',
        icon: '/assets/logo.png',
        data: { url: '/pages/dashboard.html' }
    });

    const userSubs = subscriptions.filter(sub => sub.userId === payload.sellerId);
    
    userSubs.forEach(userSub => {
        console.log('[Servidor WebPush] Disparando Notificacao', notificationPayload);
        webpush.sendNotification(userSub.subscription, notificationPayload).catch(err => {
            console.error('Erro ao enviar push', err);
        });
    });

    res.status(200).json({ success: true });
});

app.listen(3000, () => console.log('Backend de Push rodando na porta 3000'));
\`\`\`

## 3. Substituicao no Front-End 

No momento que o cliente apertar \`"Ativar notificacoes de vendas"\` e aprovar, envie o payload via POST \`/push/subscribe\`:

\`\`\`javascript
const publicVapidKey = 'SUA_CHAVE_PUBLICA_AQUI';

navigator.serviceWorker.ready.then(async (reg) => {
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicVapidKey
  });

  await fetch('http://localhost:3000/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription, userId: BC.auth.getCurrentUser().id }),
    headers: { 'Content-Type': 'application/json' }
  });
});
\`\`\`
