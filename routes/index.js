var express = require('express');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Soundcloud Analyzer' });
});

/* soundcloud login */
router.post('/login', function(req,res,next){
	var scLogin = req.body.scLogin;
	console.log(scLogin);
	
	res.status(200).send("entry point into authentication with login: " + scLogin);
});

module.exports = router;
