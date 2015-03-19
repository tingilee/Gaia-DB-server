var ObjectID = require('mongodb').ObjectID;
// convert any incoming strings to ObjectIDs if they’re to be used when comparing against an “_id” field.

/********************************************
    Entries should look like this: 

{   _id:                ,   
    time_created:           ,       
    Coordinates: [longitude (floar), latitude(float)]  ,   
    Title:      string,
    Category:   [String]    ,
    Rank:       ,
    Media:  [  Source: facebook
                Text:
                Tags:
                Image_url:
                Link:
                Rating:     },
            {   Source: instagram
                Text:
                Tags:
                Image_url:
                Link:
                Rating: }]
}
    
********************************************/

// self - current context
CollectionDriver = function(db) {
    this.db = db;
};

CollectionDriver.prototype.removeCollection = function(collectionName, callback) {
    this.db.collection(collectionName, function(error, the_collection) {
        if( error ) callback(error);
        else {
            the_collection.remove({}, function(error, results) { 
                if (error) callback(error);
                else callback(null, results);
            });
        }
    });
}

CollectionDriver.prototype.addLocation2dsphereIndex = function(collectionName, callback) {
    this.db.collection(collectionName, function(error, the_collection) {
        if( error ) callback(error);
        else {
            the_collection.ensureIndex( { 'loc.coordinates': "2dsphere" }, {bits: 32}, function(error, results) { // this returns a write concern obj
                if (error) callback(error);
                else callback(null, results);
            });
        }
    });
}

CollectionDriver.prototype.getCollection = function(collectionName, callback) {
    this.db.collection(collectionName, function(error, the_collection) {
        if( error ) callback(error);
        else callback(null, the_collection);
    });
};

CollectionDriver.prototype.findAll = function(collectionName, callback) {
    this.getCollection(collectionName, function(error, the_collection) { //A
      if( error ) callback(error);
      else {
        the_collection.find().toArray(function(error, results) { //B
          if( error ) callback(error);
          else callback(null, results);
        });
      }
    });
};

CollectionDriver.prototype.findInBoxGivenCategory = function(collectionName, minlon, maxlon, minlat, maxlat, category, callback) {
    console.log("params:  " + minlon + " " + minlat + " " + maxlon + " " + maxlat);
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) {
            callback(error);
        } else {
            the_collection.find({'loc.coordinates' :
                {$geoWithin :
                    {$geometry :
                       {type : "Polygon" ,
                           coordinates : [[[minlon, minlat] , 
                                           [minlon, maxlat], 
                                           [maxlon, maxlat],
                                           [maxlon, minlat],
                                           [minlon, minlat]]]                                     
                        } 
                    } 
                } 
            , 'category' : category}).toArray( function(error, results) {       // this should return only category has an element matching... 
                                                if (error) 
                                                    callback(error); 
                                                else
                                                    callback(null, results); });
        }
    });
}

CollectionDriver.prototype.findInBox = function(collectionName, minlon, maxlon, minlat, maxlat, callback){
    console.log("params:  " + minlon + " " + minlat + " " + maxlon + " " + maxlat);
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) {
            callback(error);
        } else {
            the_collection.find({'loc.coordinates' :
                {$geoWithin :
                    {$geometry :
                       {type : "Polygon" ,
                           coordinates : [[[minlon, minlat] , 
                                           [minlon, maxlat], 
                                           [maxlon, maxlat],
                                           [maxlon, minlat],
                                           [minlon, minlat]]]                                     
                        } 
                    } 
                } 
            }).toArray( function(error, results) {
                                                if (error) 
                                                    callback(error); 
                                                else
                                                    callback(null, results); });
        }
    });
}

CollectionDriver.prototype.findInCircle = function(collectionName, center_lon, center_lat, min_dist, max_dist, callback) {
    console.log("collectionName: " + collectionName);
    console.log("Params: " + center_lon + ", " + center_lat + " with distance between meters " + min_dist + " , " + max_dist);

    this.getCollection(collectionName, function(error, the_collection) {
        if (error) {
            callback(error);
        } else {
            console.log("try to find in this collection: " + collectionName);
            the_collection.find({
                                    geoNear: "loc.coordinates",
                                    near: { type: "Point", coordinates: [ center_lon, center_lat] },
                                    spherical: true,
                                    query: { }, // ex) query: { category: "public" },
                                    minDistance: min_dist,      // in meters
                                    maxDistance: max_dist

                                }).toArray(function(error, results) {
                                                    if (error) 
                                                        callback(error); 
                                                    else
                                                        callback(null, results);    });
        }

    });    
}

CollectionDriver.prototype.get = function(collectionName, id, callback) { 
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); 
            if (!checkForHexRegExp.test(id)) callback({error: "invalid id"});
            else the_collection.findOne({'_id':ObjectID(id)}, function(error,doc) { 
                if (error) callback(error);
                else callback(null, doc);
            });
        }
    });
};

/**************** INSERT/SAVE ****************/

//insert/save one item
CollectionDriver.prototype.save = function(collectionName, obj, callback) {
    this.getCollection(collectionName, function(error, the_collection) { 
        if( error ) callback(error)
        else {
            // obj = filter_item(obj);
            obj.time_created = new Date(); 
            the_collection.insert(obj, function() { 
                callback(null, obj);
            });
        }
    });
};

//save an array of objects
CollectionDriver.prototype.saveBulk = function(collectionName, obj, callback) {
    this.getCollection(collectionName, function(error, the_collection) { 
      if( error ) callback(error)
      else {
        var date = new Date(); 
        for (var i = 0; i < obj.length; i++) {
            // obj[i] = filter_item(obj[i]);
            obj[i].time_created = date;
        }
        the_collection.insert(obj, function() {
            callback(null, obj);
        });
      }
    });
};

/**************** UPDATE ****************/

//update a specific object
// covers over the existing one?
CollectionDriver.prototype.update = function(collectionName, obj, entityId, callback) {
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            obj._id = ObjectID(entityId); 
            obj.updated_at = new Date(); 
            the_collection.save(obj, function(error,doc) { 
                if (error) callback(error);
                else callback(null, obj);
            });
        }
    });
};

//  ADD this media item info to the media array
//  essentially each post is an item
// 
CollectionDriver.prototype.addCategoryBulk = function(collectionName, category_array, id, callback) {
    var obj = null;
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); //B
            if (!checkForHexRegExp.test(id)) {
                callback({error: "invalid id"});
            } else {
                the_collection.findOne({'_id':ObjectID(id)}, function(error,doc) { 
                    if (error) callback(error);
                    else {
                        var array = doc.category;
                        var new_array = [];
                        for (var i = 0; i < category_array.length; i++) {
                            if ( array.indexOf(category_array[i]) == -1 ) { // does not exist in the array
                                new_array.push(category_array[i]);
                            }
                        }
                        //  { $push: { scores: { $each: [ 90, 92, 85 ] } } }
                        var update = { $push : {} };
                        update.$push['category'] = { $each: new_array}; 
                        the_collection.update(  {'_id':ObjectID(id)}, update,
                                                function(error,doc) { 
                                                    if (error) callback(error);
                                                    else callback(null, doc);
                                                });

                    }
                });
            }
        }
    });
};

//  ADD this media item info to the media array
//  essentially each post is an item
CollectionDriver.prototype.addMedia = function(collectionName, media_item, source, id, callback) {
    var obj = null;
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); //B
            if (!checkForHexRegExp.test(id)) {
                callback({error: "invalid id"});
            } else {
                // update( {'_id' : id, { $push : {'media.' + source : media_item } } })
                var update = { $push : {} };
                update.$push['media.' + source] = media_item; 
                the_collection.update(  {'_id':ObjectID(id)}, update,
                                        function(error,doc) { 
                                            if (error) callback(error);
                                            else callback(null, doc);
                                        });
            }
        }
    });
};

//  ADD this media item info to the media array
//  essentially each post is an item
CollectionDriver.prototype.addMediaBulk = function(collectionName, media_item, source, id, callback) {
    var obj = null;
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); //B
            if (!checkForHexRegExp.test(id)) {
                callback({error: "invalid id"});
            } else {
                console.log("tryyyyying");
                console.log('media.' + source);
                console.log("id: " + id);
                //  { $push: { scores: { $each: [ 90, 92, 85 ] } } }
                // update( {'_id' : id, { $push : {'media.' + source : media_item } } })
                // .find( { $where: "this.name.length > 1" } );

                the_collection.findOne({'_id':ObjectID(id)}, function(error,doc) { 
                    if (error) callback(error);
                    else {
                        console.log("find one done");
                        var obj = doc;
                        if (obj.media[source]) { // if does exist... 
                            console.log("Media " + source + " exists. Do nothing. ");
                            // the_collection.update(  {'_id':ObjectID(id)},
                            //                         {$set : { 'media.' + source : media_item} }    );
                            callback(null, doc);
                        } else {
                            console.log("Media " + source + " does not exists. Simply add.");
                            var update = { $push : {} };
                            update.$push['media.' + source] = { $each: media_item}; 
                            the_collection.update(  {'_id':ObjectID(id)}, update, function(error,doc) { 
                                                                                    if (error) callback(error);
                                                                                    else callback(null, doc);
                                                                                });
                        }
                    }
                });  
            }
        }
    });
};

//  update this given media item 
// Should it over cover all the media item (now) OR should it be adding to the media fields individually 
CollectionDriver.prototype.updateMedia = function(collectionName, media_item, id, entityId, callback) {
    var obj = null;
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); //B
            if (!checkForHexRegExp.test(id)) {
                callback({error: "invalid id"});
            } else {
                the_collection.update({"media.source" : media_item.source}, {$set : {"media.$" : media_item}});

                /* 
                // an alternative: find and then modify
                the_collection.findOne({'_id':ObjectID(id)}, function(error,doc) { 
                    if (error) {
                        callback(error);
                    } else {
                        // push a media
                        var media_array = doc.media;
                        for (var i = 0; i < media_array.length; i++) {
                            if (media_array[i].source == media_item.source) {
                                var key = "media." + i;
                                the_collection.update(  {'_id':ObjectID(id)},
                                        {$set: { key: media_item}   );
                                }
                            }
                        }
                        // no such entry in the media. does this works?
                        CollectionDriver.prototype.addMedia = function(collectionName, media_item, id, entityId, callback);      
                });   
                */
            }
        }
    });
}; 

//  update rank to increase or decrease by the given inc_value
CollectionDriver.prototype.incrementRank = function(collectionName, inc_value, id, callback) {
    var obj = null;
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); 
            if (!checkForHexRegExp.test(id)) {
                callback({error: "invalid id"});
            } else {
                // find which index on the array has the same source
                id = "550a78cf8029f27c169d9b32";
                console.log("id: " + id);
                console.log("incvalue: " + inc_value);
                the_collection.update(  {'_id':ObjectID(id)},
                                        { $inc: { 'rank': inc_value } }, function(error,doc) { 
                                                                            if (error) callback(error);
                                                                            else {
                                                                                console.log(doc);
                                                                                callback(null, doc);
                                                                            }});
            }
        }
    });
}; 

//  update the essential fields of the item in case of emergency
//  field can be 'title', 'category', 'coordinates'
CollectionDriver.prototype.updateRank = function(collectionName, field_value, id, callback) {
    var obj = null;
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); 
            if (!checkForHexRegExp.test(id)) {
                callback({error: "invalid id"});
            } else {
                // find which index on the array has the same source
                the_collection.update(  {'_id':ObjectID(id)},
                                        {$set : { 'rank' : field_value} }, function(error,doc) { 
                                                                            if (error) callback(error);
                                                                            else {
                                                                                console.log(doc);
                                                                                callback(null, doc);
                                                                            }
                                                                        });
            }
        }
    });
}; 

//  update the essential fields of the item in case of emergency
//  field can be 'title', 'category', 'coordinates'
CollectionDriver.prototype.updateField = function(collectionName, field, field_value, id, callback) {
    var obj = null;
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); //B
            if (!checkForHexRegExp.test(id)) {
                callback({error: "invalid id"});
            } else {
                console.log("aaaa");
                // find which index on the array has the same source
                the_collection.update(  {'_id':ObjectID(id)},
                                        {$set : { field : field_value} }, function(error,doc) { //B
                                                                            if (error) callback(error);
                                                                            else {
                                                                                console.log("booom");
                                                                                console.log(doc);
                                                                                callback(null, doc);
                                                                            }
                                                                        });
            }
        }
    });
}; 

/**************** DELETE ****************/
//delete a specific object
CollectionDriver.prototype.delete = function(collectionName, entityId, callback) {
    this.getCollection(collectionName, function(error, the_collection) { //A
        if (error) callback(error);
        else {
            the_collection.remove({'_id':ObjectID(entityId)}, function(error,doc) { //B
                if (error) callback(error);
                else callback(null, doc);
            });
        }
    });
};

exports.CollectionDriver = CollectionDriver;
