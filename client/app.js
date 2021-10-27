var profile = { username: "Alice" };

//This object store functions you can call to make different requests to the server
var Service = {
    origin: window.location.origin,//store the URL of your server as a string

    //To fetch the list of rooms from server by making an AJAX request to Service.origin + "/chat" URL 
    //and return a Promise that resolves to the JSON response data
    getAllRooms: function () {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", this.origin + "/chat");
        xhr.send();
        return new Promise((resolve, reject) => {
            xhr.onload = function () {
                if (xhr.status == 200) {
                    var result = JSON.parse(xhr.responseText);
                    resolve(result);
                } else {
                    reject(new Error(xhr.responseText));
                }
            };
            xhr.onerror = function () {
                reject(new Error("client-side error:" + xhr.responseText));
            }

        });
    },
    // make a POST request to the Service.origin + "/chat" endpoint, with the given data in the request payload
    addRoom: function (data) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", this.origin + "/chat");
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(data));
        return new Promise((resolve, reject) => {
            xhr.onload = function () {
                if (xhr.status == 200) {
                    var result = JSON.parse(xhr.responseText);
                    resolve(result);
                } else {
                    reject(new Error(xhr.responseText));
                }
            };
            xhr.onerror = function () {
                reject(new Error("client-side error:" + xhr.responseText));
            }

        });
    },
    getLastConversation: function (roomId, before) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", this.origin + "/chat/" + roomId + "/messages" + "?before=" + encodeURI(before));
        xhr.send();
        return new Promise((resolve, reject) => {
            xhr.onload = function () {
                if (xhr.status == 200) {
                    var result = JSON.parse(xhr.responseText);
                    resolve(result);
                } else {
                    reject(new Error(xhr.responseText));
                }
            };
            xhr.onerror = function () {
                reject(new Error("client-side error:" + xhr.responseText));
            }

        });
    },
    getProfile: function () {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", this.origin + "/profile");
        xhr.send();
        return new Promise((resolve, reject) => {
            xhr.onload = function () {
                if (xhr.status == 200) {
                    var result = JSON.parse(xhr.responseText);
                    resolve(result);
                } else {
                    reject(new Error(xhr.responseText));
                }
            };
            xhr.onerror = function () {
                reject(new Error("client-side error:" + xhr.responseText));
            }

        });
    },
    logOut: function () {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", this.origin + "/logout");
        xhr.send();
        return new Promise((resolve, reject) => {
            xhr.onload = function () {
                if (xhr.status == 200) {
                    resolve(null);
                } else {
                    reject(new Error(xhr.responseText));
                }
            };
            xhr.onerror = function () {
                reject(new Error("client-side error:" + xhr.responseText));
            }

        });
    }

};
/**
 * The generator function will "remember" the last conversation fetched, and incrementally fetch the conversations as 
 * the user scrolls to the top of the chat view, until there is no more conversation blocks to be read.
 * ( "infinite scrolling")
 */
function* makeConversationLoader(room) {
    //console.log("In makeConversationLoader");
    //var lastTimeFetched = Date.now();
    var lastTimeFetched = room.timeCreated;
    while (lastTimeFetched > 0 && room.canLoadConversation) {
        room.canLoadConversation = false;
        yield new Promise((resolve, reject) => {
            Service.getLastConversation(room["id"], lastTimeFetched).then(
                result => {
                    //console.log("in makeConversationLoader, result is:", result);
                    if (result) {
                        lastTimeFetched = result["timestamp"];
                        room.canLoadConversation = true;
                        room.addConversation(result);
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                }
                , err => { console.log(err); resolve(null); }).catch(err => console.log("catch err:", err));
        })

    }
}

// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM(elem) {
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
}

// Creates a DOM element from the given HTML string
function createDOM(htmlString) {
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}
function LobbyView(lobby) {
    this.lobby = lobby;
    var self = this;
    /**
     * add a new list item to the this.listElem element, 
     * generating the DOM with the given room data. 
     */
    this.lobby.onNewRoom = function (room) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#/chat/" + room.id;
        a.innerHTML = room.name;

        var image = document.createElement("img");
        image.src = room.image;
        li.appendChild(image);
        li.appendChild(a);
        li.id = room.id;
        self.listElem.appendChild(li);
    }
    //create the DOM for the "lobby page"
    this.elem = createDOM(
        `<div class="content">
            <ul class="room-list">
                <li>
                    <a href="#/chat">Everyone in CPEN400A</a>
                </li>
                <li>
                    <a href="#/chat">Foodies only</a>
                </li>
                <li>
                    <a href="#/chat">Canucks Fans</a>
                </li>
            </ul>
            <div class="page-control">
            <input type="text"><Button>Create Room</Button>
            </div>
        </div>`
    );
    this.listElem = this.elem.querySelector("ul.room-list");
    this.inputElem = this.elem.querySelector("input");
    this.buttonElem = this.elem.querySelector("Button");
    this.redrawList();

    var self = this;
    this.buttonElem.addEventListener("click", function () {
        Service.addRoom({ name: self.inputElem.value, image: "assets/everyone-icon.png" }).then((result) => {
            self.lobby.addRoom(result._id, result.name, result.image);
            self.inputElem.value = "";//clear input value
        }, (error) => console.log(error));

    });
}

/** empty the contents of this.listElem, then populate the list dynamically from 
 * the array of Room objects inside the lobby object */
LobbyView.prototype.redrawList = function () {
    emptyDOM(this.listElem);
    for (const id in this.lobby.rooms) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#/chat/" + this.lobby.rooms[id].id;
        a.innerHTML = this.lobby.rooms[id].name;

        var image = document.createElement("img");
        image.src = this.lobby.rooms[id].image;
        li.appendChild(image);
        li.appendChild(a);
        li.id = id;
        this.listElem.appendChild(li);
    }
}

function ChatView(socket) {
    this.socket = socket;
    this.room = null;

    //create the DOM for the "chat page" 
    this.elem = createDOM(
        `<div class="content">
            <h4 class="room-name">Everyone in CPEN400A</h4>
            <div class="message-list">
                <div class="message">
                    <span class="message-user">Bob</span>
                    <span class="message-text">Do you need some help with that Charlie?</span>
                </div>
                <div class="message my-message">
                    <span class="message-user">Alice</span>
                    <span class="message-text">I can help with that too</span>
                </div>
            </div>
            <div class="page-control">
                <textarea></textarea><Button>Send</Button>
            </div>
        </div>`
    );
    this.titleElem = this.elem.querySelector("h4");
    this.chatElem = this.elem.querySelector(".message-list");
    this.inputElem = this.elem.querySelector("textarea");
    this.buttonElem = this.elem.querySelector("Button");
    this.buttonElem.addEventListener("click", () => {
        this.sendMessage();
    });
    this.inputElem.addEventListener("keyup", e => {

        //The event handler should call the sendMessage method only if the key
        // is the "enter" key without the "shift" key.
        if (e.key == "Enter" && !e.shiftKey) {
            this.sendMessage();
        }
    });

    /**
     *  trigger the entire fetch-update-render cycle when the mouse is scrolled up in the chat view
     *  Invoke the generator's next function, only if the following conditions are met:
            The scroll is at the top of the view
            Mouse scroll direction is "up"
            this.room.canLoadConversation is true
     */
    this.chatElem.addEventListener("wheel", e => {
        if (this.room.canLoadConversation == true &&
            e.deltaY < 0 &&
            this.chatElem.scrollTop == 0) {
            this.room.getLastConversation.next();
        }

    });
}
/**
 *   call the addMessage method of the this.room object.
 */
ChatView.prototype.sendMessage = function () {

    this.socket.send(JSON.stringify({ roomId: this.room.id, username: profile.username, text: this.inputElem.value }));
    this.room.addMessage(profile.username, this.inputElem.value);
    this.inputElem.value = "";
};
ChatView.prototype.setRoom = function (room) {
    this.room = room;

    //Update the this.titleElem to display the new room name
    this.titleElem.innerText = room.name;
    emptyDOM(this.titleElem);
    emptyDOM(this.chatElem);

    //dynamically create the message boxes from the this.room.messages array
    for (var i = 0; i < this.room.messages.length; i++) {
        var message = this.room.messages[i];
        var div = document.createElement("div");
        div.classList.add("message");
        if (message.username === profile.username) {
            div.classList.add("my-message");
        }
        var username_span = document.createElement("span");
        username_span.classList.add("message-user");

        var msgText_span = document.createElement("span");
        msgText_span.classList.add("message-text");

        username_span.appendChild(document.createTextNode(message.username));
        msgText_span.appendChild(document.createTextNode(message.text));
        div.appendChild(username_span);
        div.appendChild(msgText_span);
        this.chatElem.appendChild(div);
    }
    //add a new message box on this.chatElem element
    this.room.onNewMessage = (message) => {
        var div = document.createElement("div");
        div.classList.add("message");
        if (message.username === profile.username) {
            div.classList.add("my-message");
        }
        var username_span = document.createElement("span");
        username_span.classList.add("message-user");

        var msgText_span = document.createElement("span");
        msgText_span.classList.add("message-text");

        username_span.appendChild(document.createTextNode(message.username));
        msgText_span.appendChild(document.createTextNode(message.text));
        div.appendChild(username_span);
        div.appendChild(msgText_span);
        this.chatElem.appendChild(div);
    };
    this.room.onFetchConversation = (conversation) => {
        var hb = this.chatElem.scrollHeight;//record the height of chatElem before rendering

        conversation.messages.reverse().forEach(message => {
            var div = document.createElement("div");
            div.classList.add("message");
            if (message.username === profile.username) {
                div.classList.add("my-message");
            }
            var username_span = document.createElement("span");
            username_span.classList.add("message-user");

            var msgText_span = document.createElement("span");
            msgText_span.classList.add("message-text");

            username_span.appendChild(document.createTextNode(message.username));
            msgText_span.appendChild(document.createTextNode(message.text));
            div.appendChild(username_span);
            div.appendChild(msgText_span);
            // this.chatElem.scrollHeight += 50; 
            this.chatElem.prepend(div);
        });
        conversation.messages.reverse();
        var ha = this.chatElem.scrollHeight;//get the height of chatElem after rendering
        this.chatElem.scrollTop = ha - hb;
    };

}
function ProfileView() {
    //create the DOM for the "profile page"
    this.elem = createDOM(
        `<div class="content">
            <div class="profile-form">
                <div class="form-field">
                    <label>Username</label><input type="text">
                </div>
                <div class="form-field">
                    <label>Password</label><input type="password">
                </div>
                <div class="form-field">
                    <label>Avatar </label><input type="file">
                </div>
                
            </div>
            <div class="page-control">
                <button id="save_btn">Save</button>
                <button id="logout_btn">Logout</button>
            </div>
        </div>`
    );
    this.save_btn = this.elem.querySelector("#save_btn");
    this.logout_btn = this.elem.querySelector("#logout_btn");

    this.logout_btn.addEventListener("click", function () {
        Service.logOut().then((result) => {
            alert("Successfully logout!")
        }, (error) => console.log(error));

    });
}

function Room(id, name, image = "assets/everyone-icon.png", messages = []) {
    this.id = id;
    this.name = name;
    this.image = image;
    this.messages = messages;
    this.getLastConversation = makeConversationLoader(this);
    this.canLoadConversation = true;
    this.timeCreated = Date.now();
}
Room.prototype.addMessage = function (username, text) {
    if (text == "" || text.trim() == "") return;
    else {
        //"sanitize" a given user input, and then push the object into the this.messages array
        var message = { username: username, text: text };
        if (text.includes("<img") || text.includes("<button") || text.includes("</button") || text.includes("<div")) {
            message.text = " ";
        }
    }
    this.messages.push(message);
    if (typeof this.onNewMessage === "function") {
        this.onNewMessage(message);
    }
}
// insert the given messages at the beginning of the Room.messages array. Make sure the order of messages is chronological.
Room.prototype.addConversation = function (conversation) {
    console.log("Input to app.js addConversation is ", conversation);

    for (const message of conversation["messages"]) {
        this.messages.push(message)
    }
    console.log("this.messages in room now is ", this.messages);
    //this.messages.unshift(conversation["messages"]);
    this.onFetchConversation(conversation);//used to notify the ChatView that new data is available (similar to how onNewMessage works).


}
function Lobby() {
    var room1 = new Room(1, "rmOne");
    var room2 = new Room(2, "rmTwo");
    var room3 = new Room(3, "rmThree");
    var room4 = new Room(4, "rmFour");
    this.rooms = {};
}
/**
 *  search through the rooms and return the room with
 *  id = roomId if found.
 */
Lobby.prototype.getRoom = function (roomId) {
    for (const id in this.rooms) {
        if (id == roomId) {
            return this.rooms[id];
        }
    }
}

/**
 *   create a new Room object using the given arguments
 *   and add the object in the this.rooms array.
 */
Lobby.prototype.addRoom = function (id, name, image, messages) {
    var room = new Room(id, name, image, messages);
    this.rooms[room.id] = room;
    if (typeof this.onNewRoom === "function") {
        this.onNewRoom(room);
    }

}

function main() {
    //Using a WebSocket object on the client side, the client application can "listen" to messages from the server
    var socket = new WebSocket("ws://" + window.location.hostname + ":8000");
    socket.addEventListener("message", (message) => {
        console.log(message);
        var msg_obj = JSON.parse(message.data);
        var room = lobby.getRoom(msg_obj.roomId);
        room.addMessage(msg_obj.username, msg_obj.text);
    });

    //the object is the "single source of truth" within the application
    var lobby = new Lobby();
    //instantiate the view objects 
    var lobbyView = new LobbyView(lobby);
    var chatView = new ChatView(socket);
    var profileView = new ProfileView();

    /**
     * renderRoute read the URL from the address bar and then 
     * conditionally perform action based on different pages
     */
    var renderRoute = function () {
        var url_hash = window.location.hash;
        //extract the first part of the path
        var url_components_array = url_hash.split("/");
        var firstPart = url_components_array[1];
        var room_id = url_components_array[2];

        var page_view = document.getElementById("page-view");
        if (firstPart == "") {
            //If the first part of the path is an empty string ""
            //empty the contents of #page-view, and then add it with the corresponding content from the lobby page(i.e.,div.content)
            emptyDOM(page_view);
            page_view.appendChild(lobbyView.elem);
        }
        else if (firstPart == "chat") {
            //If the first part of the path is "chat", empty the contents of the #page-view, 
            //and then populate it with the corresponding content from chat.html
            emptyDOM(page_view);
            page_view.appendChild(chatView.elem);
            var currentRoom = lobby.getRoom(room_id);
            if (currentRoom != null && currentRoom.id == room_id) {
                chatView.setRoom(currentRoom);
            }
        }
        else if (firstPart == "profile") {
            ///If the first part of the path is "profile", do the same
            emptyDOM(page_view);
            page_view.appendChild(profileView.elem);
        }
    };
    /**
     * call the getAllRooms function you just created to make an AJAX request to the server. 
     * When the returned Promise resolves, update lobby.rooms object by iterating through the
     * array of rooms just received from the server. 
     */
    var refreshLobby = function () {
        Service.getAllRooms().then((result) => {
            for (var i = 0; i < result.length; i++) {
                var room = result[i];
                //If a Room already exists, update the name and image. 
                if (room._id in lobby.rooms) {
                    lobby.rooms[room._id].name = room.name;
                    lobby.rooms[room._id].image = room.image;
                }
                //If a Room does not exist, call lobby.addRoom method to add the new room.
                else {
                    lobby.addRoom(room._id, room.name, room.image, room.messages);
                }
            }
        }, (error) => console.log(error));
    };

    //attach the renderRoute function as the event handler for the popstate event
    //The popstate event is fired when the URL changes
    window.addEventListener("popstate", renderRoute);


    //get the username from the server, and assign this username in the profile object.
    Service.getProfile().then((result) => {
        console.log("update username for profile:\n");
        console.log("before: username:", profile.username);
        console.log("ater: username:", result.username);
        if (result != null) {
            profile.username = result.username;
        }
    }, (error) => console.log(error));

    //appropriate page is rendered upon page load
    renderRoute();
    refreshLobby();

    //periodically refresh the list of chat rooms by calling refreshLobby
    var time = 30000;
    var interval = setInterval(refreshLobby, time);
    //cpen400a.export(arguments.callee, { renderRoute, lobby, lobbyView, chatView, profileView, refreshLobby, socket });
}

window.addEventListener("load", main);