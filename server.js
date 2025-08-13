const express = require('express');
const http = require('node:http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const https = require('https');

const apiClient = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});
console.log('INFO: Axios client initialized with rejectUnauthorized: false.');

const {get, put} = apiClient;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: "*", credentials: true } });
console.log('INFO: Socket.IO server initialized with CORS enabled.');

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: "*", credentials: true }));
console.log('INFO: CORS middleware applied.');

app.use((req, res, next) => {
  global.request = req;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  console.log(`INFO: Incoming request: ${req.method} ${req.url}`);
  next();
});

app.use(express.json());
console.log('INFO: JSON body parser middleware applied.');

app.use(express.static('public'));
console.log('INFO: Static file serving from "public" directory enabled.');

io.on('connection', async (socket) => {
    console.log(`INFO: Socket connected: ${socket.id}`);

    socket.on('userOnline', async (userEmail, jwtToken) => {
        console.log(`DEBUG: 'userOnline' event received from ${socket.id} for user: ${userEmail}`);
        if (!userEmail) {
            console.error('ERROR: userEmail is required for userOnline event.');
            socket.emit('error', { type: 'validation', message: 'userEmail is required' });
            return;
        }

        if (!jwtToken) {
            console.error('ERROR: jwtToken is required for userOnline event for user:', userEmail);
            socket.emit('error', { type: 'validation', message: 'jwtToken is required' });
            return;
        }

        try {
            const apiUrl = `https://localhost:8000/api/user/setOnline/${userEmail}`;
            console.log(`HTTP: Making PUT request to ${apiUrl} to set user online for ${userEmail}`);
            const response = await put(apiUrl, 
                { email: userEmail },
                { 
                    headers: {
                        'Authorization': `Bearer ${jwtToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            if (response.status === 200) {
                console.log(`HTTP: Successfully set user ${userEmail} online. Status: ${response.status}`);
                io.emit('refreshConversations');
                console.log('SOCKET: Emitting "refreshConversations" to all connected sockets.');
                socket.emit('userOnlineSuccess', { userEmail, timestamp: new Date().toISOString() });
                console.log(`SOCKET: Emitting "userOnlineSuccess" to ${socket.id} for user: ${userEmail}`);
            } else {
                console.warn(`WARN: Unexpected status ${response.status} when setting user ${userEmail} online.`);
                socket.emit('userOnlineError', { userEmail, error: `Unexpected status: ${response.status}` });
                console.log(`SOCKET: Emitting "userOnlineError" to ${socket.id} for user: ${userEmail} with status error.`);
            }
        } catch (error) {
            console.error(`ERROR: Failed to set user ${userEmail} online. Error: ${error.message}`);
            socket.emit('userOnlineError', { 
                userEmail, 
                error: error.message,
                type: error.response ? 'http' : error.request ? 'network' : 'unknown'
            });
            console.log(`SOCKET: Emitting "userOnlineError" to ${socket.id} for user: ${userEmail} with catch error.`);
        }
    });

    socket.on('userOffline', async (userEmail, jwtToken) => {
        console.log(`DEBUG: 'userOffline' event received from ${socket.id} for user: ${userEmail}`);
        if (!userEmail) {
            console.error('ERROR: userEmail is required for userOffline event.');
            socket.emit('error', { type: 'validation', message: 'userEmail is required' });
            return;
        }

        if (!jwtToken) {
            console.error('ERROR: jwtToken is required for userOffline event for user:', userEmail);
            socket.emit('error', { type: 'validation', message: 'jwtToken is required' });
            return;
        }

        try {
            const apiUrl = `https://localhost:8000/api/user/setOffline/${userEmail}`;
            console.log(`HTTP: Making PUT request to ${apiUrl} to set user offline for ${userEmail}`);
            const response = await put(apiUrl, 
                { email: userEmail },
                { 
                    headers: {
                        'Authorization': `Bearer ${jwtToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            if (response.status === 200) {
                console.log(`HTTP: Successfully set user ${userEmail} offline. Status: ${response.status}`);
                io.emit('refreshConversations');
                console.log('SOCKET: Emitting "refreshConversations" to all connected sockets.');
                socket.emit('userOfflineSuccess', { userEmail, timestamp: new Date().toISOString() });
                console.log(`SOCKET: Emitting "userOfflineSuccess" to ${socket.id} for user: ${userEmail}`);
            } else {
                console.warn(`WARN: Unexpected status ${response.status} when setting user ${userEmail} offline.`);
                socket.emit('userOfflineError', { userEmail, error: `Unexpected status: ${response.status}` });
                console.log(`SOCKET: Emitting "userOfflineError" to ${socket.id} for user: ${userEmail} with status error.`);
            }
        } catch (error) {
            console.error(`ERROR: Failed to set user ${userEmail} offline. Error: ${error.message}`);
            socket.emit('userOfflineError', { 
                userEmail, 
                error: error.message,
                type: error.response ? 'http' : error.request ? 'network' : 'unknown'
            });
            console.log(`SOCKET: Emitting "userOfflineError" to ${socket.id} for user: ${userEmail} with catch error.`);
        }
    });

    socket.on('message', (msg) => {
        console.log(`DEBUG: 'message' event received from ${socket.id}:`, msg);
        io.emit('message', msg);
        console.log(`SOCKET: Emitting 'message' to all connected sockets:`, msg);
    });

    socket.on('disconnect', (reason) => {
        console.log(`INFO: Socket disconnected: ${socket.id}, Reason: ${reason}`);
    });
});

app.get('/api/symfony-data', async (req, res) => {
    console.log(`HTTP: GET request received for /api/symfony-data.`);
    try {
        console.log('HTTP: Making GET request to https://localhost:8000/api/word');
        const response = await get('https://localhost:8000/api/word');
        res.json(response.data);
        console.log(`HTTP: Successfully fetched data from Symfony, status: ${response.status}.`);
    } catch (error) {
        console.error(`ERROR: Error fetching data from Symfony for /api/symfony-data: ${error.message}`);
        res.status(500).send('Error fetching data from Symfony');
    }
});

app.post('/webhook/update-messages', (req, res) => {
    const updatedMessages = req.body.messages;
    const conversationId = req.body.conversationId;
    console.log(`WEBHOOK: Received /webhook/update-messages for conversationId: ${conversationId}`);

    io.emit('updatedMessages', updatedMessages, conversationId);
    console.log(`SOCKET: Emitting 'updatedMessages' for conversationId: ${conversationId}`);

    res.status(200).send('Webhook received');
    console.log('WEBHOOK: Sent 200 response for /webhook/update-messages.');
});

app.post('/webhook/newMessage', (req, res) => {
    const updatedMessage = req.body.message;
    const conversationId = req.body.conversationId;
    console.log(`WEBHOOK: Received /webhook/newMessage for conversationId: ${conversationId}`);

    io.emit('newMessage', updatedMessage, conversationId);
    console.log(`SOCKET: Emitting 'newMessage' for conversationId: ${conversationId}`);

    res.status(200).send('Webhook received');
    console.log('WEBHOOK: Sent 200 response for /webhook/newMessage.');
});

app.post('/webhook/send-notification',(req,res)=>{
    const normalizedNotification = req.body.notification;
    const userEmail = req.body.user_email;
    console.log(`WEBHOOK: Received /webhook/send-notification for user: ${userEmail}`);

    io.emit('getNotification',normalizedNotification,userEmail);
    console.log(`SOCKET: Emitting 'getNotification' for user: ${userEmail}`);
    res.status(200).send('webhook received');
    console.log('WEBHOOK: Sent 200 response for /webhook/send-notification.');
})

app.post('/webhook/refreshCalendar', (req, res) => {
    console.log(`WEBHOOK: Received /webhook/refreshCalendar.`);
    io.emit('refreshCalendar');
    console.log(`SOCKET: Emitting 'refreshCalendar'.`);
    res.status(200).send('Webhook received');
    console.log('WEBHOOK: Sent 200 response for /webhook/refreshCalendar.');
});

app.post('/webhook/refreshConversations', (req, res) => {
    console.log(`WEBHOOK: Received /webhook/refreshConversations.`);
    io.emit('refreshConversations');
    console.log(`SOCKET: Emitting 'refreshConversations'.`);
    res.status(200).send('Webhook received');
    console.log('WEBHOOK: Sent 200 response for /webhook/refreshConversations.');
});

const PORT = 6969;
server.listen(PORT, () => {
    console.log(`INFO: Server running on port ${PORT}`);
});
