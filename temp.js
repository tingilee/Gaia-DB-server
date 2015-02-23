var express = require('express');
var path = require('path');
var http = require('http');
//var bodyParser = require('body-parser');

//var routes = require('./routes/index');
//var users = require('./routes/users');

var app = express();
var PORT = 4000; // port of the server

//configuration =========================================================

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade'); 
app.set('port', PORT); 

app.use(express.bodyParser());
//app.use(bodyParser.urlencoded());
//app.use(bodyParser({limit: '50mb'}));
app.use(express.static(path.join(__dirname, 'public')));

// Make our db accessible to our router
app.use(function(req,res,next){
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

//app.use('/', routes);

app.get('/', function(req, res) {
	console.log("cross-origin");
	res.writeHead(200, {'Content-Type': 'text', 'Access-Control-Allow-Origin': '*'});
  	res.send('<html><body><h1>Hello World</h1></body></html>');


});

app.use(function (req,res) {
    res.render('404', {url:req.url});
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))});

