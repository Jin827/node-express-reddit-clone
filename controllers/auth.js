var express = require('express');
var bodyParser = require('body-parser')
var urlencoded = bodyParser.urlencoded({extended: false})
// body-parser: allows express to read the body and then parse that into a Json object that we can understand.
// urlencoded : Returns middleware that only parses urlencoded bodies and only looks at requests where the Content-Type header matches the type option. 
// extened    : allows to choose between parsing the URL-encoded data with the querystring library (when false) or the qs library (when true)
//              {extended: false} - the value can be a string or array 
//              {extended: true}  - any type


module.exports = function(myReddit) {
    var authController = express.Router();
    
    authController.get('/login', function(request, response) {
        response.render('login-form');
    });
    
    
    authController.post('/login', urlencoded, function(request, response) {
        
        if (!request.body){
            return response.status(400);
        }
        
        // validate username & password
        myReddit.checkUserLogin(request.body.username, request.body.password)
        
        // Insert userId & token in sessions Table
        .then(result => {
            // console.log(result[0].id, "result!!!!!!!!");
            return myReddit.createUserSession(result[0].id);
            })
         
         // set the key & value to bring it to the browser  
        .then(result => {
            // console.log(result," second result !!");
            response.cookie("SESSION", result);
            
        })
        
        .then(result => {
            response.redirect('/');
        })
        
        .catch(err=>{
            console.log(err);
            response.status(400).send(err.message);
        });
        
        
        
    });
    
    
    
    
    authController.get('/signup', function(request, response) {
        response.render('signup-form');
    });
    
    
    authController.post('/signup', urlencoded, function(request, response) {
        //console.log(request.body)
        var input = request.body;
        
        if (!input){
            return response.status(400);
        }
        
        //this is where the promise chain starts
        myReddit.createUser({
            username: input.username,
            password: input.password
        })
        .then(result=>{
            response.redirect('/auth/login');
        })
        .catch(err =>{
            response.status(400).send(err.message);
        });
    });
    
    
    return authController;
};