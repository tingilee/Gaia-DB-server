
var express = require('express'),
	http = require('http'),
    path = require('path'),
    url = require('url'),
	MongoClient = require('mongodb').MongoClient,
	Server = require('mongodb').Server,
	CollectionDriver = require('./collectionDriverGaia').CollectionDriver;

var mongoHost = 'localHost'; // Mongo host by default 
var mongoPort = 27017; // Mongo port by default 
var PORT = 3001; // port of the server
var collectionDriver;
var app = express();

/********** CONFIG **************************/

app.set('port', PORT); 
app.set('views', path.join(__dirname, 'views')); 
app.set('view engine', 'jade'); 
 
// after the app.set lines, but before any app.use or app.get lines:
// express now parses the incoming body data
app.use(express.bodyParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req,res,next){
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
 
var mongoClient = new MongoClient(new Server(mongoHost, mongoPort)); 
mongoClient.open(function(err, mongoClient) { 
  	if (!mongoClient) {
      	console.error("Error! Exiting... Must start MongoDB first");
      	process.exit(1); //D
 	 }
  	var db = mongoClient.db("MyDatabase");  
  	collectionDriver = new CollectionDriver(db); 
});

app.all('/', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
 });

app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/', function(req, res){
  res.send('id: ' + req.query.id);
});

// gets the collection by filtering on locations
app.get('/:collection', function(req, res) {
    // find a square
    console.log("findNearby");
    
    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;
    var minlon = parseInt(params.minlon);
    var maxlon = parseInt(params.maxlon);
    var minlat = parseInt(params.minlat);
    var maxlat = parseInt(params.maxlat);
    console.log(params);
    console.log("params:  " + minlon + " " + minlat + " " + maxlon + " " + maxlat);

    collectionDriver.findNearby(req.params.collection, minlon, maxlon, minlat, maxlat, function(error, objs) { 
        if (error)
            res.send(400, error);
        res.set('Content-Type','application/json');
        res.send(200, objs); 
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

// Add item/items to collection 
app.post('/:collection', function(req, res) {
    var object = req.body;
    var length = object.length;
    var collection = req.params.collection;
    var count = 0;
    var response = "";
    var error_message = "";

    if (!length) {      // single item. undefined array length
        console.log("insert 1 item in " + collection);
        collectionDriver.save(collection, object, function(err, docs) {
            if (err) { res.send(400, err);  } 
            else { res.send(201, docs); }
        });
    } else { 
        console.log("insert " + length + " items in " + collection);              
        collectionDriver.saveBulk(collection, object, function(err, docs) {
            if (err) { res.send(400, err);  } 
            else { res.send(201, docs); }
        });
    }
});

// Update the item 
app.put('updateMedia/:collection/:entity', function(req, res) { 
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
    res.header("Content-Type", "text/html");  
    res.write('<html><body><h1>Hello Gaia</h1></body></html>');  
    res.end();  
});
 
// default
app.use(function (req,res) {
    res.render('404', {url:req.url});
});


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))});
 

