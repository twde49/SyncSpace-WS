
const express = require('express');
const http = require('node:http');
const socketIo = require('socket.io');
const cors = require('cors');
const {get} = require("axios");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: "*", credentials: true } });

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: "*", credentials: true }));

app.use((req, res, next) => {
  global.request = req;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});


app.use(express.json());

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('message', (msg) => {
        console.log(`Message received: ${msg}`);
        io.emit('message', msg);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

app.get('/api/symfony-data', async (req, res) => {
    try {
        const response = await get('https://localhost:8000/api/word');
        res.json(response.data);
    } catch (error) {
        res.status(500).send('Error fetching data from Symfony');
    }
});

app.post('/webhook/update-messages', (req, res) => {
    const updatedMessages = req.body.messages;

    io.emit('updatedMessages', updatedMessages);
    console.log('messages updated via webhook:', updatedMessages);

    res.status(200).send('Webhook received');
});

app.post('/webhook/update-conversations',(req,res)=>{
    const updatedConversations = req.body.conversations;

    io.emit('updatedConversations',updatedConversations);
    console.log('conversations updated via webhook:', updatedConversations)

    res.status(200).send('webhook received');
})


const PORT = 6969;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
