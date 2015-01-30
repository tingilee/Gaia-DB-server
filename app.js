
var express = require('express'),
	http = require('http'),
	path = require('path'),
	MongoClient = require('mongodb').MongoClient,
	Server = require('mongodb').Server,
	CollectionDriver = require('./collectionDriver').CollectionDriver;

var mongoHost = 'localHost'; // Mongo host by default 
var mongoPort = 27017; // Mongo port by default 
var PORT = 3000; // port of the server
var collectionDriver;

//var routes = require(./routes/index);
//var users = require(./routes/users);

var app = express();
app.set('port', PORT); 
app.set('views', path.join(__dirname, 'views')); //A
app.set('view engine', 'jade'); //B
 
// after the app.set lines, but before any app.use or app.get lines:
// express now parses the incoming body data
app.use(express.bodyParser());

app.use(express.static(path.join(__dirname, 'public')));



 
var mongoClient = new MongoClient(new Server(mongoHost, mongoPort)); //B
mongoClient.open(function(err, mongoClient) { //C
  if (!mongoClient) {
      console.error("Error! Exiting... Must start MongoDB first");
      process.exit(1); //D
  }
  var db = mongoClient.db("MyDatabase");  //E
  collectionDriver = new CollectionDriver(db); //F
});

// MongoDB collection
// doesn't work when i add get before the /:collection? whyy
app.get('/:collection', function(req, res) { //A
   var params = req.params; //B
   collectionDriver.findAll(req.params.collection, function(error, objs) { //C
    	  if (error) { res.send(400, error); } //D
	      else { 
	      	
	        if (req.accepts('html')) { //E
    	        res.render('rawdata',{objects: objs, collection: req.params.collection}); //F
              	
              } else {
	          	res.set('Content-Type','application/json'); //G
                res.send(200, objs); //H
              }
         }
   	});
});
 
app.get('/:collection/:entity', function(req, res) { //I
   var params = req.params;
   var entity = params.entity;
   var collection = params.collection;
   if (entity) {
       collectionDriver.get(collection, entity, function(error, objs) { //J
          if (error) { res.send(400, error); }
          else { res.send(200, objs); } //K
       });
   } else {
      res.send(400, {error: 'bad url', url: req.url});
   }
});

app.post('/:collection', function(req, res) { //A
    var object = req.body;
    var collection = req.params.collection;
    var newObj = {};
    var longitude, latitude;
    // filter out the fields to store
    if (object.longitude && object.latitude) {
    	newObj.longitude = object.longitude;
    	newObj.latitude = object.latitude;
    	newObj.title = object.title;
    }
    console.log(newObj);
	     

    collectionDriver.save(collection, newObj, function(err,docs) {
          if (err) { res.send(400, err); } 
          else { res.send(201, docs); } //B
     });
});

// this updates the item 
app.put('/:collection/:entity', function(req, res) { //A
    var params = req.params;
    var entity = params.entity;
    var collection = params.collection;
    if (entity) {
       collectionDriver.update(collection, req.body, entity, function(error, objs) { //B
          if (error) { res.send(400, error); }
          else { res.send(200, objs); } //C
       });
   } else {
       var error = { "message" : "Cannot PUT a whole collection" };
       res.send(400, error);
   }
});

app.delete('/:collection/:entity', function(req, res) { //A
    var params = req.params;
    var entity = params.entity;
    var collection = params.collection;
    if (entity) {
       collectionDriver.delete(collection, entity, function(error, objs) { //B
          if (error) { res.send(400, error); }
          else { res.send(200, objs); } //C 200 b/c includes the original doc
       });
   } else {
       var error = { "message" : "Cannot DELETE a whole collection" };
       res.send(400, error);
   }
});

/*
app.get('/insert', function (req, res) {
  res.send('<html><body><h1>Insert into table</h1></body></html>');
});

app.get('/get', function (req, res) {
  res.send('<html><body><h1>Get from table</h1></body></html>');
});

app.post('/postinsert', function (req, res) {
  res.send('<html><body><h1>HTTP POST: insert into table</h1></body></html>');
});
*/

// :a? means wildcard. can be anything
/*
app.get('/:a?/:b?/:c?', function (req,res) {
	res.send(req.params.a + ' ' + req.params.b + ' ' + req.params.c);
});
*/


app.get('/', function (req, res) {
  res.send('<html><body><h1>Hello World</h1></body></html>');
});
 
// default
app.use(function (req,res) {
    res.render('404', {url:req.url});
});


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))});
 

