var usernames = {};
var rooms = {};

var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var bodyParser = require('body-parser');


var https = require('https').Server({
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem')
}, app);


var io = require('socket.io')(https);
//app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

https.listen(8888, function() {
    console.log('listening on https://localhost:8888');
});

app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
    extended: true
}));

app.get('/', function(req, res) {
	res.render('home.ejs',{
	    "msg": ""
	});
});

app.post('/login', function(request, response) {
    var userName = request.body.userName;
    var roomName = request.body.room;
    var authKey = request.body.auth;
    console.log(new Date().toLocaleString() + " USERNAME:" + userName + " ROOM:" + roomName + " KEY:" + authKey);
    var patt = /[^a-z\d]/i;
    //console.log("Not valid username: (false says valid)" + patt.test(userName));
    if ((userName == "" || roomName == "") || (patt.test(userName) || patt.test(roomName))) {
        response.render('home.ejs',{
            "msg": "Only Alphanumeric input is accepted"
        });
    } else if (authKey != "webrtc@123#") {
        response.render('home.ejs',{
            "msg": "Invalid Auth Key"
        });
    } else if (usernames[userName]) {
        response.render('home.ejs',{
            "msg": "We are Sorry, This username not avialable"
        });
    } else {
    	response.render('meeting.ejs',{
            "user": userName,
            "room": roomName
        });
    }
});

io.sockets.on('connection', function(socket) {
    socket.on('addUser', function(username, room) {
        console.log(new Date().toLocaleString() + ' Adding user: ' + username);
        socket.username = username;
        socket.room = room;
        usernames[username] = socket;
        socket.join(room);
        if (!rooms[room])
            rooms[room] = {};
        rooms[room][username] = username;
        socket.emit('updateChat', 'SERVER', 'You are now connected to room: ' + socket.room);
        socket.broadcast.to(socket.room).emit('updateChat', 'SERVER', socket.username + ' has join the room: ' + socket.room);
        socket.broadcast.to(socket.room).emit('updateUsers', Object.keys(rooms[room]), username);
        socket.emit('updateUsers', Object.keys(rooms[room]), username);

        socket.broadcast.to(socket.room).emit('connuser', Object.keys(rooms[room]), username);
    });

    socket.on('chatMessage', function(data) {
        socket.broadcast.to(socket.room).emit('updateChat', socket.username, data);
        console.log(socket.room + ' : data is ' + data + " user:" + socket.username);
    });

    socket.on('disconnect', function() {
        console.log('deleting');
        if ((!!socket) && usernames[socket.username])
            delete usernames[socket.username];
        if ((!!socket) && rooms[socket.room][socket.username])
            delete rooms[socket.room][socket.username];
        if (!(!socket)) {
            console.log(new Date().toLocaleString() + ' LEFTUSER: ' + socket.username);
            socket.broadcast.to(socket.room).emit('updateUsers', Object.keys(rooms[socket.room]), "");
            socket.broadcast.to(socket.room).emit('updateChat', 'SERVER', socket.username + ' has left', socket.username);
            socket.leave(socket.room);
        }
    });

    socket.on('chat message', function(msg) {
        console.log("MESSAGE : " + msg);
        socket.broadcast.to(socket.room).emit('updateChat', 'SERVER', "SDP", msg);
        var signal = JSON.parse(msg);
        console.log("SIGNAL : ");
        console.log(signal);
        var to = signal.choosed;
        console.log("TO  : " + to);
        console.log("<br><br><br>Received: " + msg + " to be send to: " + signal.choosed);
        signal.choosed = socket.username;
        console.log('<br><br><br>Now sending to: ' + to + " choosing: " + signal.choosed);
        msg = JSON.stringify(signal);
        try {
            usernames[to].emit('chat message', msg);
        } catch (e) {
            console.log("ALL FUCKERS");
        }
    });

});