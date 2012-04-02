
/**
 * Module dependencies.
 */

var express = require('express'),
	http = require('http');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.use(express.bodyParser());
  app.use(express.methodOverride());
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

var soundSystemHost = 'localhost';
var soundSystemPort = 8000;
var LastBuildStatus = {};

function alertBrokenBuild(buildName) {
	var speakText = buildName + ' build is broken';
	var playPath = '/play?file=broken-build.wav';//&speech=' + speakText;
	
	var options = {
	  host: soundSystemHost,
	  port: soundSystemPort,
	  path: playPath
	};

	http.get(options, function(res) {
		console.log('Build alert successful.');
		console.log('');
	}).on('error', function(e) {
		console.log('Build alert failure.');
		console.log('');
	});
}

// Routes

app.get('/lastbuilds',function(req,res) {
	var response = '';
	for (var build in LastBuildStatus) {
		response += build + ': ' + LastBuildStatus[build] + '<br/>';
	}
	res.send(response);
});

app.post('/buildstatuschange', function (req,res) {
	var currTime = new Date() + ' -> ';
	var buildStatus = req.param('buildStatus','missing?');
	var buildName = req.param('buildName','noname');
	var buildNumber = req.param('buildNumber','000');
	var buildInfo = buildName + ' (' + buildNumber + ') ';
	var buildPassTag = '[PASSED]';
	var buildFailTag = '[FAILED]';
	
	var failed = buildStatus.indexOf('FAILURE') > -1 || buildStatus.indexOf('Tests failed') > -1;
	
	console.log('');
	
	if(LastBuildStatus[buildName] === buildStatus) {
		//ignore repeat failures
		console.log(currTime + 'No change, Ignored build: ' + buildInfo + buildFailTag);
		res.send('ignored');
		return;
	}
	
	//update build status
	LastBuildStatus[buildName] = buildStatus;
	
	if(!failed) {
		console.log(currTime + 'Build succeeded: ' + buildInfo + buildPassTag);
		res.send('passed');
		return;
	}
	
	console.log(currTime + buildInfo + buildFailTag  + '<<<<<<<<<<<<');
	console.log('New Status: ' + buildStatus);
	alertBrokenBuild(buildName);
	
	res.send('failed');
});

app.listen(8001);
console.log("Build monitor listening on port %d in %s mode", app.address().port, app.settings.env);
