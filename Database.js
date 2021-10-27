const { MongoClient, ObjectID } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our app.
 */
function Database(mongoUrl, dbName) {
    if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
    this.connected = new Promise((resolve, reject) => {
        MongoClient.connect(
            mongoUrl,
            {
                useNewUrlParser: true
            },
            (err, client) => {
                if (err) reject(err);
                else {
                    console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
                    resolve(client.db(dbName));
                }
            }
        )
    });
    this.status = () => this.connected.then(
        db => ({ error: null, url: mongoUrl, db: dbName }),
        err => ({ error: err })
    );
}

Database.prototype.getRooms = function () {
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
			/* read the chatrooms from `db`
			 * and resolve an array of chatrooms */
            var collection = db.collection("chatrooms");
            collection.find({}).toArray(function (err, result) {
                if (err) reject(err);
                else {
                    resolve(result);
                }

            });
        })
    )
}

Database.prototype.getRoom = function (room_id) {
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
			/* read the chatroom from `db`
			 * and resolve the result */
            console.log("Input into database.js getRoom:\n", room_id);
            let id;
            try {
                id = ObjectID(room_id);
            } catch (err) {
                id = room_id;
            }
            var query = { _id: id };
            var collection = db.collection("chatrooms");

            collection.find(query).toArray(function (err, result) {
                if (err) reject(err);
                else if (result.length == 0) {
                    console.log("Output from database.js getRoom:\n", null);
                    resolve(null);
                } else {
                    console.log("Output from database.js getRoom:\n", result[0]);
                    resolve(result[0]);
                }
            });
        })
    )
}

Database.prototype.addRoom = function (room) {
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
			/* insert a room in the "chatrooms" collection in `db`
			 * and resolve the newly added room */
            //if id is unassigned by the user, we will let mongodb to assign one 
            console.log("Input into database.js addRoom:\n", room);
            if (room["name"]) {
                var collection = db.collection("chatrooms");
                collection.insertOne(room, function (err, result) {
                    if (err) reject(err);
                    else {
                        var inserted_room = result.ops[0];
                        console.log("Output of database.js addRoom:\n", inserted_room);
                        resolve(inserted_room);
                    }
                })
            } else {//If the name field in the room object is not provided, the Promise should reject with an Error.
                reject("Please provide the name of the room you want to create.");
            }
        })
    )
}

Database.prototype.getLastConversation = function (room_id, before) {
    return this.connected.then(db =>
        new Promise(async (resolve, reject) => {
			/* read a conversation from `db` based on the given arguments
			 * and resolve if found */
            console.log("Input into database.js getLastConversation:", room_id, before);
            var time;
            if (!before) {
                time = Date.now();
                console.log("No before is provided, we will generate one:", time)
            } else {
                time = parseInt(before);
            }
            var query = { $and: [{ room_id: room_id }, { timestamp: { $lt: time } }] };
            var mysort = { timestamp: -1 };//If multiple Conversation objects are found, it should select the one whose timestamp is closest to before.
            var collection = db.collection("conversations");

            collection.find(query).sort(mysort).toArray(function (err, result) {
                if (err) reject(err);

                else if (result.length == 0) {//The Promise should resolve to null if no Conversation was found.
                    console.log("Output from database.js getLastConversation:\n", null);
                    resolve(null);
                } else {
                    console.log("Output from database.js getLastConversation:", result[0], "with room_id:", room_id, "and before:", before, " time: ", time);
                    resolve(result[0]);
                }
            });
        })
    )
}

Database.prototype.addConversation = function (conversation) {
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
			/* insert a conversation in the "conversations" collection in `db`
			 * and resolve the newly added conversation */
            console.log("Input into database.js addConversation:", conversation);
            if (conversation["room_id"] && conversation["timestamp"] && conversation["messages"]) {
                var collection = db.collection("conversations");
                collection.insertOne(conversation, function (err, result) {
                    if (err) reject(err);
                    else {
                        var inserted_conversation = result.ops[0];
                        console.log("Output from database.js addConversation:", inserted_conversation);
                        resolve(inserted_conversation);
                    }
                })
            } else {//if any fields other than _id is not provided, reject w/ an error
                reject("Error:Please provide all fields:room_id, timestamp, messages");
            }

        })
    )
}
/**
 * It accepts a single username argument and queries the users collection for a document with the username
 * field equal to the given username. The method should return a Promise that resolves to the user document if found,
 * null otherwise.
 */
Database.prototype.getUser = function (username) {
    return this.connected.then(db =>
        new Promise((resolve, reject) => {
            console.log("Input into database.js getUser:", username);
            var collection = db.collection("users");
            var query = { username: username };
            collection.find(query).toArray(function (err, result) {
                if (err) reject(err);

                else if (result.length == 0) {//The Promise should resolve to null if no user was found.
                    console.log("Output from database.js getUser:\n", null);
                    resolve(null);
                } else {
                    console.log("Output from database.js getUser:", result[0], "with username:", username);
                    resolve(result[0]);
                }
            });

        })
    )

}

module.exports = Database;