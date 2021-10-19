const crypto = require('crypto');

class SessionError extends Error { };

function SessionManager() {
    // default session length - you might want to
    // set this to something small during development
    const CookieMaxAgeMs = 600000;

    // keeping the session data inside a closure to keep them protected
    const sessions = {};

    // might be worth thinking about why we create these functions
    // as anonymous functions (per each instance) and not as prototype methods
    this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
        console.log("Input tocreateSession():" + "username:" + username + " maxAge:" + maxAge)
        var token = crypto.randomBytes(100).toString('hex');
        var timeTokenCreated = Date.now();
        sessions[token] = { username: username, timeTokenCreated: timeTokenCreated, timeExpired: timeTokenCreated + maxAge };
        response.cookie('cpen400a-session', token, { maxAge: maxAge });

        //maxAge milliseconds after a session data is created, it should be deleted from the sessions dictionary.
        setTimeout(() => delete sessions[token], maxAge);

    };

    this.deleteSession = (request) => {
        var cookie = request.session;
        delete request.username;
        delete request.session;
        if (cookie != null) {
            delete sessions[cookie];
        }
    };

    this.middleware = (request, response, next) => {

        //read the cookie information from the HTTP header 
        var cookie = request.headers.cookie;
        //If the cookie header was not found, "short-circuit" the middleware by calling the next function, passing in a SessionError object, and returning immediately
        if (cookie == null) {
            next(new SessionError('no cookie is found'));
        }
        else {
            //parse the cookie string 
            cookie = cookie.split(';').map(s => s.split('=').pop().trim()).shift();

            // check if the token (cookie value) is found in the sessions object

            if (sessions[cookie] == null) {//If it was not found, short-circuit the middleware
                next(new SessionError('no cookie is found'));
            }
            /*If the session exists, assign the username  to a new username property on the request object and a property 
            named session and set its value to the cookie value (the token).*/
            else {
                request.username = sessions[cookie].username;
                request.session = cookie;
                next();// call next with zero arguments to trigger the next middleware.
            }
        }
    };

    this.middlewareErrorHandler = function (err, req, res, next) {
        console.error(err)
        //check if the error is a SessionError instance
        if (err instanceof SessionError) {
            //If it is, respond according to the Accept header of the request.

            //If the accept header specifies application/json, return HTTP 401 with the error message.

            if (req.headers.accept == 'application/json') {
                res.status(401).send(JSON.stringify(err.message));
            }
            //Otherwise, redirect the request to the /login page. 
            else {
                res.redirect('/login');
            }
        }
        //If the error is not a SessionError object, return HTTP 500.
        else {
            res.status(500).send();
        }
    }

    // this function is used by the test script.
    // you can use it if you want.
    this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;
