
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

var app = express();
app.set('port', PORT); 
app.set('views', path.join(__dirname, 'views')); 
app.set('view engine', 'jade'); 
 
// after the app.set lines, but before any app.use or app.get lines:
// express now parses the incoming body data
app.use(express.bodyParser());

app.use(express.static(path.join(__dirname, 'public')));
 
var mongoClient = new MongoClient(new Server(mongoHost, mongoPort)); 
mongoClient.open(function(err, mongoClient) { 
  	if (!mongoClient) {
      	console.error("Error! Exiting... Must start MongoDB first");
      	process.exit(1); //D
 	 }
  	var db = mongoClient.db("MyDatabase");  
  	collectionDriver = new CollectionDriver(db); 
});

// Get the entire collection (Table)
app.get('/:collection/:format', function(req, res) {
   	var params = req.params; 
   	collectionDriver.findAll(req.params.collection, function(error, objs) { 
    	if (error) { 
    		res.send(400, error); 
    	} else { 
          if (req.params.format == 'json') {
            res.send(200, objs); 
          } else if (req.params.format == 'table') {
            if (req.accepts('html')) { 
             res.render('data',{objects: objs, collection: req.params.collection}); //F
              
            } else {
              res.set('Content-Type','application/json');
                res.send(200, objs); 
            }
          }
	        
        }
   	});
});
 
// Get specific item
app.get('/:collection/:entity', function(req, res) { 
   	var params = req.params;
   	var entity = params.entity;
   	var collection = params.collection;
   	if (entity) {
       	collectionDriver.get(collection, entity, function(error, objs) { 
          if (error) { res.send(400, error); }
         	else { res.send(200, objs); }
       });
   	} else {
      	res.send(400, {error: 'bad url', url: req.url});
   	}
});

function filterObjection(object) {
	var newObj = {};
    // filter out the fields to store
    if (object.longitude && object.latitude) {
    	newObj.longitude = object.longitude;
    	newObj.latitude = object.latitude;
    	newObj.title = object.title;
    	newObj.source = object.source;
    	newObj.description = object.description;
    }
    return newObj;
}

// Add item to collection 
app.post('/:collection', function(req, res) {
    var object = req.body;
    var collection = req.params.collection;
    var newObj = filterObjection(object);
    console.log(newObj + " is now added to collection " + collection);	// print Json

    collectionDriver.save(collection, newObj, function(err,docs) {
          if (err) { res.send(400, err); } 
          else { res.send(201, docs); }
     });
});

// Update the item 
app.put('/:collection/:entity', function(req, res) { 
    var params = req.params;
    var entity = params.entity;
    var collection = params.collection;
    if (entity) {
       collectionDriver.update(collection, req.body, entity, function(error, objs) { //B
          if (error) { res.send(400, error); }
          else { res.send(200, objs); }
       });
   } else {
       var error = { "message" : "Cannot PUT a whole collection" };
       res.send(400, error);
   }
});

// Delete the item from collection
app.delete('/:collection/:entity', function(req, res) {
    var params = req.params;
    var entity = params.entity;
    var collection = params.collection;
    if (entity) {
       collectionDriver.delete(collection, entity, function(error, objs) {
          if (error) { res.send(400, error); }
          else { res.send(200, objs); } 
       });
   } else {
       var error = { "message" : "Cannot DELETE a whole collection" };
       res.send(400, error);
   }
});

app.get('/', function (req, res) {
  res.send('<html><body><h1>Hello World</h1></body></html>');
});
 
// default
app.use(function (req,res) {
    res.render('404', {url:req.url});
});


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))});
 

