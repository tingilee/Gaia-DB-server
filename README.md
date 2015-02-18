# Gaia-DB-server

To start the server:
	forever start app.js 

**************************************
DB APIs

To GET the entire database:
	HTTP GET
	http://host_address:3000
	
TO GET a subset of the database (with filter):
	HTTP GET
	http://host_address:3000?minlat=0&maxlat=118&minlon=0&maxlon=120
	// Need all four parameters for the coordinates
	maxlat 118 means <118 non-inclusive

To ADD an item:
	HTTP POST
	Content-Type: application/json
	'{"longitude":119, "latitude":117, "title":"home cafe", "source":"yelp", "text":"a"}'
	http://host_address:3000
	Filter to only allow keys: 
		longitude	latitude	title	source	description	imageURL	text	premanentLink

To UPDATE an item:
	HTTP PUT 
	'{"title":"new update"}' 
	http://host_address:3000/items/{_id}
	// This also adds a key of "updated_at"

To DELETE an item:
	HTTP DELETE
	http://host_address:3000/items/{_id}


