var express = require('express');
var SC = require('node-soundcloud');
var url = require('url');

var router = express.Router();
var apitoken = null;

var client_id = null;

/* GET home page. */
router.get('/', function(req, res, next) {
	
	res.render('index', { title: 'Soundcloud Analyzer' });
});

// helper function that will query firebase to see if a soundcloud
// api token already exists
function getToken(firebase, callback) {
	firebase.database().ref('token/').once('value', function(snapshot) {
		if (snapshot.val() === null) {
			callback(null);
		} else {
			apitoken = snapshot.val().apitoken;
			console.log('found existing apitoken: ' + apitoken);
			callback(apitoken);
		}
	}, function(err) {
		console.error(err);
		callback(null);
	});
}


// helper function to initialize soundcloud connection
function initSoundcloud(token) {
	console.log('initialize SC');
	
	if(token === null) {
		// initialize soundcloud
		SC.init({
			id: '1e53c4ae982294b190c1428238d6cc0e',
			secret: 'b5038e333752749cfafcbd4a3fda8ff5',
			uri: 'http://localhost:3000/callback'
		});
	} else {
		SC.init({
			id: '1e53c4ae982294b190c1428238d6cc0e',
			secret: 'b5038e333752749cfafcbd4a3fda8ff5',
			uri: 'http://localhost:3000/callback',
			accessToken: token
		});
	}
	
	var url = SC.getConnectUrl();
	
	return url;
}

// entry point route for soundcloud authentication
router.post('/login', function(req,res,next){
	
	var firebase = req.app.get('firebase');
	
	// if apitoken has already been set in memory use it
	if(apitoken !== null) {
		res.render('soundcloud-connect');
		return;
	}
	
	// if token exists in the DB then use it
	// else connect to Soundcloud for authorization
	getToken(firebase, function(apitoken) {
		console.log("got token " + apitoken);
		// if we already have an api token we can use it
		// else we need to initialize using soundcloud authorization callback
		if(apitoken !== null) {
			res.render('soundcloud-connect');
			return;
		} else {
			var connectURL = initSoundcloud();
			console.log('connect URL: ' + connectURL);
		
			res.writeHead(301,{'Location': connectURL});
			res.end();
		}
	});
	
});

// route to handle soundcloud callback with client token
router.get('/callback', function(req,res,next){
	console.log('query object: ' + req);
	var token = req.query.code;
	console.log('received token ' + token);
	
	var firebase = req.app.get('firebase');
	
	firebase.database().ref('token/').set({
		apitoken: token,
		timestamp: Date.now()
	});
	
	apitoken = token;
	
	res.render('soundcloud-connect');
});

// route that is entry point for processing a users soundcloud profile
router.post('/process', function(req, res, next){
	var scProfileURL = req.body.scProfileURL;
	console.log(scProfileURL);
	
	// init soundcloud connection
	initSoundcloud(apitoken);
	
	var params = {
			url: scProfileURL,
			client_id: SC.getConfig().client_id
	};
		
	console.log('params for resolve: ' + params.url + ' ' + params.client_id);
	
	// call resolve API
	SC.get('/resolve', params, function(err, resolve){
		if(err) {
			console.log('error: ' + err);
		} else {
			// determine user path from location returned
			var urlObj = url.parse(resolve.location);
			var userPath = urlObj.pathname.split('.json')[0];
			console.log('user path returned from resolve call: ' + userPath);
			
			// using the user name get the user information from Soundcloud
			SC.get(userPath, function(e, userData){
				if(e) {
					console.log('error: ' + e);
				} else {
					
					// write user object to database
					var firebase = req.app.get('firebase');
					
					firebase.database().ref('users/').set(userData);
					console.log('wrote user info to db for user ' + userData.username);
					
					res.render('soundcloud-user', {json: userData});
				}
			});
		}
	});
});

function processFavorites(firebase, followingID, followerID) {
	
	// get favorited tracks for the user from SC
	SC.get('/users/' + followerID + '/favorites', function(err, favoriteList){
		if(err) {
			throw err;
		} else {
			console.log('got favorites for user ' + followerID);
			
			// save favorites to the DB
			var numFavorites = favoriteList.length;
			for(var j=0; j<numFavorites; j++) {
				
				var fav = favoriteList[j];
				fav.followingID = followingID;
				fav.followerID = followerID;
				firebase.database().ref('favorites/' + fav.followerID).set(fav);
			}
			
		}
	});
}

// route to handle getting followers information for a user
router.get('/followers', function(req,res,next){
	
	// user ID whose followers we want to get is in the request
	var followingID = req.query.userID;
	
	var firebase = req.app.get('firebase');
	
	SC.get('/users/' + followingID + '/followers', function(e, followerList){
		if(e) {
			console.log('error getting SC followers: ' + e);
		} else {
			console.log('follower list for user ' + followingID + ': ' + followerList);
			
			// loop over followers
			var numFollowers = followerList.collection.length;
			for(var i=0; i<numFollowers; i++) {
				var follower = followerList.collection[i];
				
				// save follower to DB
				follower.followingID = followingID;
				firebase.database().ref('followers/' + follower.id).set(follower);
				
				processFavorites(firebase, followingID, follower.id);
			}
		}
	});
	
	res.render('soundcloud-finished');
	
});

module.exports = router;
