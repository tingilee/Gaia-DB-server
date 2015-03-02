
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

app.use(express.static(path.join(__dirname, 'public')));

app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

/************** End of config *******************/

function checkGaiaDB(collectionName) {
    //return (collectionName == 'gaiadb');
    return true;    // accept all collection names
}

/***************************        GET        ***************************/

// Get the entire collection (Table OR json)
app.get('/:collection', function(req, res) {
   	var params = req.params; 
    var collection = req.params.collection;
    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;

    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }

   	collectionDriver.findAll(req.params.collection, function(error, objs) { 
    	if (error) { 
    		res.send(400, error); 
    	} else {
            if (params.format == 'json') {
                res.send(200, objs); 
            } else if (params.format == 'table') {
                if (req.accepts('html')) { 
                    res.render('data',{objects: objs, collection: req.params.collection});
              
                } else {
                    res.set('Content-Type','application/json');
                    res.send(200, objs); 
                }
            }    
        }
   	});
});

// Get specific item. This returns everything
app.get('/:collection/getitem', function(req, res) { 
    var params = req.params;
    var collection = params.collection;
    var url_parts = url.parse(req.url, true);
    var entityid = url_parts.query.id;
    console.log('Get item with id: ' + entityid);

    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }

    if (entityid) {
        collectionDriver.get(collection, entityid, function(error, objs) { 
            if (error)  { res.send(400, error); }
            else        { res.send(200, objs); }
        });
    } else {
        res.send(400, {error: 'bad url', url: req.url});
    }
});

// gets a subset of the collection by filtering on location coordinates
app.get('/:collection/filter', function(req, res) {
    console.log("filter: " + req.url);
    // find a square
    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }
    
    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;
    var minlon = parseInt(params.minlon);
    var maxlon = parseInt(params.maxlon);
    var minlat = parseInt(params.minlat);
    var maxlat = parseInt(params.maxlat);
    console.log("params:  " + minlon + " " + minlat + " " + maxlon + " " + maxlat);

    collectionDriver.findNearby(req.params.collection, minlon, maxlon, minlat, maxlat, function(error, objs) { 
        if (error)
            res.send(400, error);
        res.set('Content-Type','application/json');
        res.send(200, objs); 
    });
});

/***************************        POST        ***************************/
// Add item/items to collection 
// Takes in the following:
// {coordinates : [ <longitude> , <latitude> ],
//  title: <place name>     ,
//  category: <place types> ,
//  source:   <source>,     (optional)
//  location_id:  <id>      (optional)}
app.post('/:collection', function(req, res) {
    var obj = req.body;
    var length = obj.length;
    var collection = req.params.collection;
    var db_insert_array = [];
    var count = 0;
    var error_message = null;
    var array;
    console.log("POST item(s)");

    if (!length) {  // if it's an element, put it into an array
        length = 1;
        array = [];
        array.push(obj);
    } else {
        array = obj;
    }

    // loopover the array
    for (var i = 0; i < length; i++) {
        var object = array[i];
        // filter and only put the qualified ones into the array
        if (object.title && object.coordinates && object.category) { // need category??!!
            if (!object.coordinates.length || object.coordinates.length != 2) {
                error_message = {'error' : 'coordinates needs to be a 2 element array. coordinates : [ <longitude> , <latitude> ]'};
            } else {
                // construct the right object.
                object['rank'] = 0;    // initialize rank to 0 
                object['media'] = {};   // empty arrays     // "yelp": [], "google": [], "twitter": [], "facebook": [], "instagram": []
                if (object.location_id && object.source) {
                    var media_item = {"location_id" : object.location_id};
                    var media_array = [];
                    media_array.push(media_item);
                    object['media'][object.source] = media_array;
                }
                db_insert_array.push(object);
                count = count + 1;
            }
        } else {
            error_message = {'error' : 'requires object title, coordinates, category'};
        }
    }

    if (count == 0) {
        res.send(400, error_message);
        return;
    } else {    // just the object
        /*
        if (count == 1) {
            console.log("insert 1 item in " + collection);
            collectionDriver.saveBulk(collection, db_insert_array[i], function(err, docs) {
               if (err) { res.send(400, err);  } 
                else { res.send(201, docs); }
            });
        } */
        console.log("insert " + count + " items in " + collection);              
        collectionDriver.saveBulk(collection, db_insert_array, function(err, docs) {
            if (err) { res.send(400, err);  } 
            else { res.send(201, docs); }
        });
    }
});

/***************************        PUT(update)        ***************************/

function filterMedia(object) {
    var newObj = {};
    for (var key in object) {
        if (key == 'location_id' | key == 'post_id' | key == 'text' | key == 'tags' | key == 'image_url' | 
            key == 'link' | key == 'rating') {
            newObj.key = object.key;   
            console.log(key + object.key);
        }
    }
}

// Add a media item to the media array     
// /:collection/addMedia?id=      &source=
app.put('/:collection/addMedia', function(req, res) {
    var object = req.body;
    var collection = req.params.collection;

    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;
    var source = params.source;
    var entityid = params.id;
    console.log('Update media on item with id: ' + entityid + ' on source ' + source);

    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }

    if (entityid) {
       collectionDriver.addMedia(collection, object, source, entityid, function(error, objs) {
            if (error) { res.send(400, error); }
            else { res.send(200, objs); }
       });
    } else {
       var error = { error : 'No item _id given'};
       res.send(400, error);
    }
});

// Update the media information given the entity id and the source 
// ?id= &source=
// not really needed...
app.put('/:collection/updateMedia', function(req, res) { 
    var object = req.body;
    var params = req.params;
    var collection = params.collection;
    
    var url_parts = url.parse(req.url, true);
    var entityid = url_parts.query.id;
    var source = url_parts.query.source;
    console.log('Update media on item with id: ' + entityid + ' on source ' + source);

    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }

    if (entityid) {
       collectionDriver.addMedia(collection, object, entityid, function(error, objs) {
            if (error) { res.send(400, error); }
            else { res.send(200, objs); }
       });
   } else {
       var error = { error : 'No item _id given'};
       res.send(400, error);
   }
});

// Update the item to a totally different item
app.put('/:collection/:entity', function(req, res) { 
    var params = req.params;
    var entity = params.entity;
    var collection = params.collection;
    if (entity) {
       collectionDriver.update(collection, req.body, entity, function(error, objs) {
            if (error) { res.send(400, error); }
            else { res.send(200, objs); }
       });
   } else {
       var error = { "message" : "Cannot PUT a whole collection" };
       res.send(400, error);
   }
});

/***************************        DELETE        ***************************/

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

/***************************        DEFAULT        ***************************/

app.get('/', function (req, res) {
    res.header("Content-Type", "text/html");  
    res.write('<html><body><h1>Hello Gaia</h1></body></html>');  
    res.end();  
});
 
// default: no such url
app.use(function (req,res) {
    res.render('404', {url:req.url});
});


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))});
 

