const express = require('express');
const http = require('node:http');
const socketIo = require('socket.io');
const cors = require('cors');
const {get, put} = require("axios");

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

io.on('connection', async (socket) => {
    
    socket.on('userOnline', async (userEmail,jwtToken) => {
        try{
          console.log('trying to set online');
          const response = await put(`https://localhost:8000/api/user/setOnline/${userEmail}`, 
              { email: userEmail },
              { 
                  headers: {
                      'Authorization': `Bearer ${jwtToken}`
                  }
              }
          );
          if(response.status === 200){
            io.emit('refreshConversations')
          }else{
            console.error('Failed to set user online');
          }
        }catch(error){
            console.error(error);
        }
    });

    socket.on('userOffline', async (userEmail,jwtToken) => {
        try{
          const response = await put(`https://localhost:8000/api/user/setOffline/${userEmail}`, 
              { email: userEmail },
              { 
                  headers: {
                      'Authorization': `Bearer ${jwtToken}`
                  }
              }
          );
          if(response.status === 200){
            io.emit('refreshConversations')
          }else{
            console.error('Failed to set user offline');
          }
        }catch(error){
            console.error(error);
        }
    });

    socket.on('message', (msg) => {
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
    const conversationId = req.body.conversationId;

    console.log(req.body);
    io.emit('updatedMessages', updatedMessages, conversationId);

    res.status(200).send('Webhook received');
});

app.post('/webhook/newMessage', (req, res) => {
    const updatedMessage = req.body.message;
    const conversationId = req.body.conversationId;

    console.log(req.body);
    io.emit('newMessage', updatedMessage, conversationId);

    res.status(200).send('Webhook received');
});

app.post('/webhook/send-notification',(req,res)=>{
    const normalizedNotification = req.body.notification;
    const userEmail = req.body.user_email;

    io.emit('getNotification',normalizedNotification,userEmail);
    res.status(200).send('webhook received');
})

app.post('/webhook/refreshCalendar', (req, res) => {
    io.emit('refreshCalendar');
    res.status(200).send('Webhook received');
});

app.post('/webhook/refreshConversations', (req, res) => {
    io.emit('refreshConversations');
    res.status(200).send('Webhook received');
});

const PORT = 6969;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
