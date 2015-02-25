var ObjectID = require('mongodb').ObjectID;
// convert any incoming strings to ObjectIDs if they’re to be used when comparing against an “_id” field.

// self - current context
CollectionDriver = function(db) {
  this.db = db;
};

var filter_item = function(object) {
    var newObj = {};
    // filter out the fields to store
    console.log("filter_item: " + object.longitude + object.latitude);
    if (object.longitude && object.latitude) {  // make sure this place exists
        newObj.longitude = object.longitude;
        newObj.latitude = object.latitude;
        newObj.title = object.title;
        newObj.source = object.source;
        newObj.description = object.description;
        newObj.imageURL = object.imageURL;
        newObj.text = object.text;
        newObj.premanentLink = object.premanentLink;
        newObj.index = object.index;        // For ranking.
    }
    return newObj;
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

CollectionDriver.prototype.findNearby = function(collectionName, minlon, maxlon, minlat, maxlat, callback) {
    // console.log("collectionName: " + collectionName);
    // console.log("longitude: " + minlon + " to " + maxlon);
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) {
            callback(error);
        } else {
            the_collection.find( {"longitude": {$gt: minlon, $lt: maxlon}, "latitude": {$gt: minlat, $lt: maxlat} } ).toArray(function(error, results) {
                if (error) 
                    callback(error); 
                else
                    callback(null, results);
            });
        }

    });    
}

CollectionDriver.prototype.get = function(collectionName, id, callback) { //A
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$"); //B
            if (!checkForHexRegExp.test(id)) callback({error: "invalid id"});
            else the_collection.findOne({'_id':ObjectID(id)}, function(error,doc) { //C
                if (error) callback(error);
                else callback(null, doc);
            });
        }
    });
};

//insert/save one item
CollectionDriver.prototype.save = function(collectionName, obj, callback) {
    this.getCollection(collectionName, function(error, the_collection) { 
        if( error ) callback(error)
        else {
            obj = filter_item(obj);
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
            obj[i] = filter_item(obj[i]);
            obj[i].time_created = date;
        }
        the_collection.insert(obj, function() {
            callback(null, obj);
        });
      }
    });
};

//update a specific object
CollectionDriver.prototype.update = function(collectionName, obj, entityId, callback) {
    this.getCollection(collectionName, function(error, the_collection) {
        if (error) callback(error);
        else {
            obj._id = ObjectID(entityId); //A convert to a real obj id
            obj.updated_at = new Date(); //B
            the_collection.save(obj, function(error,doc) { //C
                if (error) callback(error);
                else callback(null, obj);
            });
        }
    });
};

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
