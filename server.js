var express = require('express'),
	http = require('http'),
    path = require('path'),
    url = require('url'),
	MongoClient = require('mongodb').MongoClient,
	Server = require('mongodb').Server,
	CollectionDriver = require('./collectionDriverGaia').CollectionDriver;

var natural = require('natural'),
    tokenizer = new natural.TreebankWordTokenizer();
natural.PorterStemmer.attach();

var mongoHost = 'localHost'; // Mongo host by default 
var mongoPort = 27017; // Mongo port by default 
var PORT = 3000; // port of the server
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
// Adds the index to collection
// Call this after there's a few element
app.get('/:collection/add2dsphereIndex', function(req, res) {
    var collection = req.params.collection;
    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }

    collectionDriver.addLocation2dsphereIndex(collection, function(error, objs) { 
            if (error) {
                res.send(400, error);
            } else {
                console.log(objs);
                res.send(200, objs); 
            }});      
});

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

var filterFloat = function (value) {
    if(/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/
      .test(value))
      return Number(value);
  return NaN;
}

// gets a subset of the collection by filtering on location coordinates
app.get('/:collection/filter/:method', function(req, res) {
    var params = req.params;
    var collection = params.collection;
    var method = params.method;

    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;

    console.log("filter: " + req.url);
    // find a square
    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }
    
    if (method == 'circle') {
        var center_lon = filterFloat(params.center_lon);    
        var center_lat = filterFloat(params.center_lat);
        var min_dist = parseInt(params.min_dist);       // meters in integer
        var max_dist = parseInt(params.max_dist);

        collectionDriver.findInCircle(req.params.collection,  center_lon, center_lat, min_dist, max_dist, function(error, objs) { 
            if (error) {
                res.send(400, error);
            } else {
                res.set('Content-Type','application/json');
                res.send(200, objs); 
            }
        });

    } else if (method == 'box') {
        var minlon = filterFloat(params.minlon);
        var maxlon = filterFloat(params.maxlon);
        var minlat = filterFloat(params.minlat);
        var maxlat = filterFloat(params.maxlat);
        var category = params.category;
        console.log("params:  " + minlon + " " + minlat + " " + maxlon + " " + maxlat);
        if (category) { 
            collectionDriver.findInBoxGivenCategory(req.params.collection, minlon, maxlon, minlat, maxlat, category, function(error, objs) { 
                if (error) {
                    res.send(400, error);
                } else {
                    res.set('Content-Type','application/json');
                    res.send(200, objs); 
                }
            });
        
        } else {
            collectionDriver.findInBox(req.params.collection, minlon, maxlon, minlat, maxlat, function(error, objs) { 
                if (error) {
                    res.send(400, error);
                } else {
                    res.set('Content-Type','application/json');
                    res.send(200, objs); 
                }
            });
        
        }
            

    }

});

/***************************        POST        ***************************/
// Add item/items to collection 
// Takes in the following:
// {longitude: , 
//  latitude: ,
//  title: <place name>     ,
//  category: [coffee, cafe...],
//  source:   <source>,     (optional)
//  media: [...],      (optional)
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

    // for checking duplicates
    var distance_threshold = 0.7;
    var lon_gap = 0.0006     
    var lat_gap = 0.0006


    // In order to do for loops synchronously
    var index = 0;
    process(index); 

    function process(index) {
        if (index >= length) {
            console.log("The cycle ended");
            res.send(201, {"success": "successfully inserted an array of " + length + " items"});
        } else {
            var client_object = array[index];
            var db_object = {};
            // filter and only put the qualified ones into the array
            if (client_object.title && client_object.category && client_object.longitude && client_object.latitude) { // need category??!!
                
                var longitude = client_object.longitude;
                var latitude = client_object.latitude;
                var title = client_object.title;
                
                var minlon = filterFloat(longitude) - lon_gap;
                var maxlon = filterFloat(longitude) + lon_gap;
                var minlat = filterFloat(latitude) - lat_gap;
                var maxlat = filterFloat(latitude) + lat_gap;
                console.log("I: " + index + "  findDuplicate() -- longitude: " + longitude + " latitude: " + latitude);

                if (!client_object.category.length) {
                    res.send(400, {'error': 'category should be an array'}); 
                    return;
                }

                // First checks if there's duplicates in the DB, if there is, cluster it. 
                collectionDriver.findInBox(req.params.collection, minlon, maxlon, minlat, maxlat, function(error, objs) { 
                    if (error) {
                        res.send(400, error);
                        // console.log("error");
                    } else {
                        var duplicate_exists = false;
                        console.log("there is " + objs.length + " items in the radius. ");
                        if (objs.length > 0) {        
                            console.log("objs " + objs);
                            var to_be_inserted_title = title; // .tokenizeAndStem().sort();
                            var max_similarity = {'distance' : 0.7, 'id' : ''};
                            for (var i = 0; i < objs.length; i++) { 
                                var db_item_title = objs[i].title; // .tokenizeAndStem().sort()
                                console.log("DB item title -- " + db_item_title + "To-be-inserted item title -- " + to_be_inserted_title);
                                var distance = natural.JaroWinklerDistance(to_be_inserted_title, db_item_title);
                                console.log("distance: "+ distance);
                                if (distance >  max_similarity['distance']) { 
                                    console.log("***** there's a duplicate *****");
                                    console.log("{distance: " + distance + ", id: " + objs[i]._id);
                                    max_similarity['distance'] = distance;
                                    max_similarity['id'] = objs[i]._id.toString();
                                }
                            }  
                            if (max_similarity['distance'] > 0.7) {   // there's at least one item that's a fit, update to choose the max one
                                console.log("there is a duplicate with id "  + max_similarity['id']);
                                duplicate_exists = true;
                                var category_array = client_object.category;
                                var media_source = client_object.source;
                                var media_array = client_object.media;
                                if (!media_array) {
                                    // ERROR!!!!
                                    console.log("ERROR: there should be a media array!!");
                                } else {
                                    console.log(media_array);
                                    collectionDriver.addMediaBulk(collection, media_array, media_source, max_similarity['id'], function(error, objs) {
                                        collectionDriver.addCategoryBulk(collection, client_object.category, max_similarity['id'], function(error, objs) {
                                            if (error) {  /* res.send(400, error); */ } 
                                            else {    /* res.send(201, objs); */ console.log("Added media and category for object_id " + max_similarity['id']); }  
                                            index = index + 1;
                                            process(index);
                                            return;
                                        });
                                    });
                                }
                            }
                        }
                        if (!duplicate_exists) {           // there's no duplicate!! 
                            db_object['title'] = client_object.title;
                            db_object['category'] = client_object.category;     // this is an array
                            db_object['loc'] = {type: 'Point', coordinates: [client_object.longitude, client_object.latitude]};
                            db_object['rank'] = 1;    // initialize rank to 0 
                            db_object['media'] = {};   // empty arrays     // "yelp": [], "google": [], "twitter": [], "facebook": [], "instagram": []
                            
                            var media_array = [];
                            if (client_object.media) {
                                media_array = client_object.media;
                            } 
                            db_object['media'][client_object.source] = media_array;
                            console.log("there's no duplciate. adding media_array: "  + media_array);
                            collectionDriver.save(collection, db_object, function(err, docs) {
                                if (err) { /* res.send(400, err); */ } 
                                else {  /* res.send(201, docs); */ console.log("Added new location for object_id " + docs._id.toString());}
                                index = index + 1;
                                process(index);
                                return;
                            }); 
                        }
                    }
                });
            } else {
                error_message = {'error' : 'requires object\'s title, longitude, latitude, category'};
            }            
        }
    }

    //     // for saving an array at once (if not checking duplicates)            
    //     collectionDriver.saveBulk(collection, db_insert_array, function(err, docs) {
    //         if (err) { res.send(400, err);  } 
    //         else { res.send(201, docs); }
    //     });
    // }
});

/***************************        PUT(update)        ***************************/

function filterMedia(object) {
    var newObj = {};
    for (var key in object) {
        if (key == 'location_id' | key == 'post_id' | key == 'text' | key == 'tags' | key == 'image_url' | 
            key == 'link' | key == 'rating') {
            newObj[key] = object[key];   
            console.log(key + object[key]);
        }
    }
    return newObj;
}

// Add a media item to the media array     
// /:collection/addMedia?id=      &source=
app.put('/:collection/addMedia', function(req, res) {
    var object = req.body;
    var length = object.length;
    var collection = req.params.collection;

    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;
    var source = params.source;
    var entityid = params.id;
    console.log('Update media on item with id: ' + entityid + ' on source ' + source);

    if (!checkGaiaDB(collection)) {
        res.send(400, {error: 'no such collection'}); 
    }

    if (!length) {  // an element
        if (entityid && source) {
           collectionDriver.addMedia(collection, object, source, entityid, function(error, objs) {
                if (error) { res.send(400, error); }
                else { res.send(200, objs); }
           });
        } else {
           var error = { error : 'No item _id or source given'};
           res.send(400, error);
        }
    } else {        // an array
        if (entityid && source) {
           collectionDriver.addMediaBulk(collection, object, source, entityid, function(error, objs) {  
                if (error) { res.send(400, error); }
                else { res.send(200, objs); }
           });
        } else {
           var error = { error : 'No item _id or source given'};
           res.send(400, error);
        }
    }
});

//  Updates the rank by incrementing or decrementing by that value
//  ?id= &incvalue=
app.put('/:collection/incrementRank', function(req, res) {
    var collection = req.params.collection;
    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;
    var inc_value = params.incvalue;
    var entityid = params.id;

    collectionDriver.incrementRank(collection, inc_value, entityid, function(error, objs) {  
        if (error) { res.send(400, error); }
        else { res.send(200, objs); }
    });
});

//  Updates the rank by incrementing or decrementing by that value
//  ?id= &value=
app.put('/:collection/updateRank', function(req, res) {
    var collection = req.params.collection;
    var url_parts = url.parse(req.url, true);
    var params = url_parts.query;
    var new_value = params.value;
    var entityid = params.id;
    console.log("updateRank " + new_value);

    collectionDriver.updateRank(collection, new_value, entityid, function(error, objs) {  
        if (error) { res.send(400, error); }
        else { res.send(200, objs); }
    });
});

// Update the media information given the entity id and the source 
// ?id= &source=
// not really needed...
/*
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
       collectionDriver.updateMedia(collection, object, entityid, function(error, objs) {
            if (error) { res.send(400, error); }
            else { res.send(200, objs); }
       });
   } else {
       var error = { error : 'No item _id given'};
       res.send(400, error);
   }
});
*/

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
          else { res.send(200, "Item id: " + entity + " is successfully deleted\n"); } 
       });
   } else {
       var error = { "message" : "Cannot DELETE a whole collection" };
       res.send(400, error);
   }
});

/***************************        DELETE WHOLE COLLECTION (comment this out when its not needed)       ***************************/

app.get('/:collection/removeCollection', function(req, res) {
    var params = req.params;
    var collection = params.collection;

    collectionDriver.removeCollection(collection, function(error, objs) {
        if (error) { res.send(400, error); }
        else { res.send(200, objs); } 
    });
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
 

