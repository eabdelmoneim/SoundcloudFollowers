var express = require('express');
var SC = require('node-soundcloud');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Soundcloud Analyzer' });
});

function initSoundcloud() {
	console.log('initialize SC')
	// initialize soundcloud
	SC.init({
		id: '1e53c4ae982294b190c1428238d6cc0e',
		secret: 'b5038e333752749cfafcbd4a3fda8ff5',
		uri: 'http://localhost:3000/callback'
	});
	
	var url = SC.getConnectUrl();
	
	return url;
}

/* soundcloud login */
router.post('/login', function(req,res,next){
	
	var connectURL = initSoundcloud();
	console.log('connect URL: ' + connectURL);
	
	res.writeHead(301,{'Location': connectURL});
	res.end();
	
});

/* soundcloud callback to get client token */
router.get('/callback', function(req,res,next){
	var token = req.query.code;
	console.log('received token ' + token);
	
	res.render('soundcloud-connect');
});

router.post('/process', function(req, res, next){
	var scProfileURL = req.body.scProfileURL;
	console.log(scProfileURL);
	
	res.status(200).send("ready to process profile URL: " + scProfileURL);
});

module.exports = router;
