
/**
 * Module dependencies.
 */

var express = require('express'),
	fs = require('fs'),
	spawn = require('child_process').spawn,
	exec = require('child_process').exec,
	http = require('http');

var app = module.exports = express.createServer();

var pid = null;
var currentSoundFile = '';
var mplayer;
// Configuration

app.configure(function(){
  app.use(express.bodyParser());
  app.use(express.methodOverride());
//  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});


function playSound(filename) {
	var options = {
	  host: 'localhost',
	  port: 8000,
	  path: '/play&file=' + filename
	};

	http.get(options, function(res) {
		console.log('Played sound: ' + filename);
		console.log('');
	}).on('error', function(e) {
		console.log('Failed to play sound: ' + filename);
		console.log('');
	});
}

function speakText(text) {
	var options = {
	  host: 'localhost',
	  port: 8000,
	  path: '/speak&text=' + text
	};

	http.get(options, function(res) {
		console.log('Spoke text: ' + text);
		console.log('');
	}).on('error', function(e) {
		console.log('Failed to speak text: ' + text);
		console.log('');
	});
}

// Routes

var LastBuildStatus = {};

app.get('/lastbuilds',function(req,res) {
	var response = '';
	for (var build in LastBuildStatus) {
		response += build + ': ' + LastBuildStatus[build] + '<br/>';
	}
	res.send(response);
});

app.post('/buildstatuschange', function (req,res) {
	var buildStatus = req.param('buildStatus','missing?');
	var failed = buildStatus.indexOf('FAILURE') > -1 || buildStatus.indexOf('Tests failed') > -1;
	var statusMsg = 'PASSED';
	if(failed) {statusMsg = 'FAILED';}
	var buildName = req.param('buildName','noname');
	var buildNumber = req.param('buildNumber','000');
	
	if(LastBuildStatus[buildName] === buildStatus) {
		//ignore repeat failures
		console.log('ignored build: ' + buildName + ' (' + buildNumber + ') [' + statusMsg + ']');
		res.send('ignored');
		return;
	}
	
	LastBuildStatus[buildName] = buildStatus;
	
	console.log('----=[ ' + buildName + ' (' + buildNumber + ') ]=----');
	console.log('Completion Time: ' + new Date());
	console.log('New Status: ' + buildStatus);
	console.log('Notes: ' + statusMsg);
	
	if(failed) {
		playSound('build-broken.wav');
		speakText(buildName + ' build is broken');
	}
	
	console.log('---------------------------------------------')
	console.log('');
	res.send('ok');
});

app.listen(8001);
console.log("Build monitor listening on port %d in %s mode", app.address().port, app.settings.env);
