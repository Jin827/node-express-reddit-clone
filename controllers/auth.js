var express = require('express');
var bodyParser = require('body-parser')
var urlencoded = bodyParser.urlencoded({extended: false})

// body-parser: allows express to read the body and then parse that into a Json object that we can understand.
// urlencoded : Returns middleware that only parses urlencoded bodies and only looks at requests where the Content-Type header matches the type option. 
// extened    : allows to choose between parsing the URL-encoded data with the querystring library (when false) or the qs library (when true)
//              {extended: false} - the value can be a string or array 
//              {extended: true}  - any type

var cookieParser = require('cookie-parser');

/*Unlike other languages we dont have to declare 'myReddit'
as a new Object of redditAPI class (from reddit.js) here 
It has already been done in index.js(line 19-24), so here we just pass it in 'module.exports = function(myReddit)'*/


module.exports = function(myReddit) {
    /*Routing refers to determining how an application responds to a client request to a particular endpoint
      Route Structure -> 'app.METHOD(PATH, HANDLER)'
      app: an instance of express
      HANDLER: the function executed when the route is matched*/

    /*ROUTER: A mini express application.
    It allows to create multiple instances of the router and then apply them to our application accordingly*/

    //get an instance of Router
    var authController = express.Router();
    
    authController.get('/login', function(request, response) {
        if(request.cookies.SESSION)
        {
            console.log("You are already logged in");
            response.redirect('/');
        }
        else
        {
        response.render('login-form');
        }

    });
    

    //request.body contains a form of data
    //BUT we can only use it when paseed through a body parser middleware
    authController.post('/login', urlencoded, function(request, response) {
        

        if (!request.body)
        {

            return response.status(400);
        }
        
        // validate username & password
        myReddit.checkUserLogin(request.body.username, request.body.password)
        
        // Insert userId & token in sessions Table
        .then(result => {
            // console.log(result[0].id, "userId");
            return myReddit.createUserSession(result[0].id);
            })
         
         // set the key & value to bring it to the browser  
        .then(result => {
            //console.log(result,"token(sessionId) from myRreddit.createUserSession")
            response.cookie("SESSION", result); // SESSION can be accessed as request.cookies.SESSION
            response.redirect('/');
        })
        
        .catch(err=>{
            console.log(err);
            response.status(400).send(err.message);
        });
    });
    
    
    authController.get('/signup', function(request, response) {
        if(request.cookies.SESSION)
        {
            console.log("Log out to create new user");
            response.redirect('/');
        }
        else
        {
            response.render('signup-form');
        }
    });
    
    
    authController.post('/signup', urlencoded, function(request, response) {
        //console.log(request.body)
        if (!request.body)
        {
            return response.status(400).send(err.message);
        }
        
        //this is where the promise chain starts
        myReddit.createUser({
            username: request.body.username,
            password: request.body.password
        })
        .then(result=>{
            response.redirect('/auth/login');
        })
        .catch(err =>{
            response.status(400).send(err.message);
        })
    });
    
    authController.get('/error', function(request, response) {
        response.render('error');
    })
    
    // //FOR LOGGING OUT
    // authController.get('/logout', function(request, response) {
    //     response.locals.logoutForm = true;
    //     response.render('logout-form');
    // });
    
    // authController.post('/logout', function(request, response) {
    //     myReddit.deleteSessionFromToken(request.cookies.SESSION)
    //     .then(result => { //NTS:then cause promises are async
    //         response.clearCookie("SESSION");
    //         console.log("You Logged Out");
    //         response.locals.logoutForm = false;
    //         response.redirect('/'); 
    //     });
    // });
    return authController;
};



/*
2xx = Success
3xx = Redirect
4xx = User error
5xx = Server error

Success codes:

200 - OK (the default)
201 - Created
202 - Accepted (often used for delete requests)

User error codes:

400 - Bad Request (generic user error/bad data)
401 - Unauthorized (this area requires you to log in)
404 - Not Found (bad URL)
405 - Method Not Allowed (wrong HTTP method)
409 - Conflict (i.e. trying to create the same resource with a PUT request)
*/

