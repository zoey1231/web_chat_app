
// assuming cpen400a-tester.js is in the same directory as server.js
const cpen400a = require('./cpen400a-tester.js');
const WebSocket = require('ws');
const broker = new WebSocket.Server({ port: 8000 });

const path = require('path');
const fs = require('fs');
const express = require('express');
const crypto = require('crypto');

var database = require('./Database.js');
var mongoUrl = "mongodb://localhost:27017";
var dbName = "cpen400a-messenger";
var db = new database(mongoUrl, dbName);

var SessionManager = require("./SessionManager.js");
var sessionManager = new SessionManager();

function logRequest(req, res, next) {
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug




var messages = {};
function getMessages() {
	db.getRooms().then((rooms) => {
		rooms.forEach(room => {
			messages[room._id] = [];
		})
	});
}
function isCorrectPassword(password, saltedHash) {
	var saltStr = saltedHash.substring(0, 20);
	var base64 = saltedHash.substring(20);
	return base64 == crypto.createHash('sha256').update(password + saltStr).digest("base64");
};
const messageBlockSize = 10;//this number will indicate how many messages to include in a conversation.

app.use('/chat/:room_id/messages', sessionManager.middleware);
app.use('/chat/:room_id', sessionManager.middleware);
app.use('/chat', sessionManager.middleware);
app.use('/profile', sessionManager.middleware);

app.route('/chat').get(function (req, res, next) {
	var result = [];
	db.getRooms().then(rooms => {
		rooms.forEach(room => {
			getMessages();
			result.push({
				_id: room._id,
				name: room.name,
				image: room.image,
				messages: messages[room._id]
			});
		});
		res.status(200).send(result);
	}).catch(err => res.status(404).send(err));
})
	.post(function (req, res, next) {
		//console.log("Input into POST /chat:\n", req.body);
		db.addRoom(req.body).then(result => {
			getMessages();
			//console.log("Output of POST /chat:\n", result);
			res.status(200).send(JSON.stringify(result));
		})
			.catch(err => res.status(400).send(err));

	});

app.route('/chat/:room_id').get(function (req, res, next) {
	var roomID = req.params["room_id"];
	//console.log("Input into GET /chat/", roomID);
	db.getRoom(roomID).then(room => {
		if (room == null) {
			//console.log("Output of POST /chat:\n", room);
			res.status(404).send("Room" + roomID + " was not found");
		}
		else {
			//console.log("Output of POST /chat:\n", room);
			res.status(200).send(room);
		}
	}).catch(err => res.status(404).send(err));
});

app.route('/chat/:room_id/messages').get(function (req, res, next) {
	var roomID = req.params["room_id"];
	var before = req.query["before"];
	//console.log("Input to GET /chat/:room_id/messages:", roomID, before);
	db.getLastConversation(roomID, before).then(
		conversation => {
			if (conversation == null) {
				//console.log("Output of GET /chat/:room_id/messages:\n", conversation);
				res.status(404).send("Conversation with Room " + roomID + " and timestamp " + before + "was not found");
			} else {
				//console.log("Output of GET /chat/:room_id/messages:\n", conversation);
				res.status(200).send(conversation);
			}

		}).catch(err => res.status(404).send(err));
});
/**
 * simply returns an object containing a property username - 
 * this value can be obtained from the Request object you augment in the session middleware.
 */
app.route('/profile').get(function (req, res, next) {
	res.status(200).send({ username: req.username });
});
/**
 * delete the session associated with the request by calling sessionManager.deleteSession. 
 * Then, send a redirect response to the login page.
 * 
 */
app.route('/logout').get(function (req, res, next) {
	sessionManager.deleteSession(req);
	res.redirect('/login');
});
//TODO: CREATE A "SIGNOUT" BUTTON in the client app

app.route('/login')
	.post(function (req, res, next) {
		//console.log("Input into POST /login:\n", req.body);
		var username = req.body.username;
		var password = req.body.password;
		var maxAge = req.body.maxAge;
		db.getUser(username).then(result => {

			//If the user is not found, redirect back to the /login page.
			if (result == null) {
				res.redirect('/login');
			}
			//if user is found, check the password and create a new session using the createSession function,and then redirect the request to /
			else {
				if (isCorrectPassword(password, result.password)) {
					sessionManager.createSession(res, username);
					res.redirect('/');
				}
				else {
					//If the password is incorrect, redirect back to the /login page.
					res.redirect('/login');
				}
			}
		})
			.catch(err => res.status(400).send(err));

	});

app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});

broker.on('connection', function connection(ws, request) {
	//read the cookie information 
	var cookie = request.headers.cookie;
	// If the cookie is not present or the cookie value is invalid, close the client socket. 
	if (cookie == null || sessionManager.getUsername(cookie.split('=')[1]) == null) {
		broker.clients.forEach((client) => {
			if (client == ws && client.readyState === WebSocket.OPEN) {
				client.close();
			}
		});
	}
	//If the cookie is valid, proceed as usual.
	ws.on('message', function incoming(message) {
		//console.log('Input to broker %s', message);

		var message_obj = JSON.parse(message);
		//"sanitize" a given user input
		if (message_obj.text.includes("<img") || message_obj.text.includes("<button") || message_obj.text.includes("</button") || message_obj.text.includes("<div")) {
			message_obj.text = " ";
		}
		//overwrite the username field with the username associated with the socket's session, 
		//before forwarding the message to the other clients.
		var userName = sessionManager.getUsername(cookie.split('=')[1]);
		message_obj.username = userName;
		broker.clients.forEach((client) => {
			console.log("clients: " + client + " , ");
			if (client != ws) {
				client.send(JSON.stringify(message_obj));
			}
		})
		var message = { username: userName, text: message_obj.text };
		var roomID = message_obj.roomId;
		if (!messages[roomID]) {
			messages[roomID] = [];
		}
		messages[roomID].push(message);
		//console.log("in broker,now messages is:\n", messages);
		//If the length of the corresponding messages[message.roomId] array is equal to messageBlockSize after pushing the new message,
		// create a new Conversation object and add to the database by calling db.addConversation
		if (messages[roomID].length == messageBlockSize) {
			var conversation = {
				room_id: roomID,
				timestamp: Date.now(),
				messages: messages[roomID]
			};

			db.addConversation(conversation).then(result => {
				//console.log("In borker, Input to addConversation is:\n", conversation);
				//if successfully added, empty the corresponding messages array to collect new messages.
				messages[roomID] = [];
				//console.log("add conversation successfully");
			}).catch(err => res.status(404).send(err));
		}
	});
});

// use the same express.static middleware to serve the protected files (index.html and app.js) with the SessionManager.middleware included
app.use('/app.js', sessionManager.middleware, express.static(clientApp + '/app.js'));
app.use('/index.html', sessionManager.middleware, express.static(clientApp + '/index.html'));
app.use('/index', sessionManager.middleware, express.static(clientApp + '/index.html'));

//When the path is exactly "/", you only want to serve index.html only. Also you need to protect it with your middleware
app.use('[/]', sessionManager.middleware, express.static(clientApp + '[/]'));

// still need to serve the rest of the client directory when the path matches something other than "/".
app.use('/', express.static(clientApp, { extensions: ['html'] }));



app.use(sessionManager.middlewareErrorHandler);
// at the very end of server.js
cpen400a.connect('http://35.183.65.155/cpen400a/test-a5-server.js');
cpen400a.export(__filename, { app, messages, broker, db, messageBlockSize, sessionManager, isCorrectPassword });