// Data required by app
var smtpData = require('./smtpData.json'),
	soundSysData = require('./soundSysData.json'),
	phoneticMap = require('./phoneticMapping.json');

// Module dependencies.
var express = require('express'),
	http = require('http'),
	exec = require('child_process').exec,
	mailer = require('nodemailer').createTransport('SMTP', smtpData);

var LastBuildStatus = {};
var brokenBuildSound = 'broken-build.wav';
var brokenPersonalBuildSound = 'broken-personal-build.wav';
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


// Alert helpers
function getPhoneticBuildName(buildName) {
	var spokenName = buildName
	if(buildName in phoneticMap) {
		spokenName = phoneticMap[buildName];
	}
	
	return spokenName;
}

function alertBrokenBuild(buildSound, buildName) {
	var phoneticBuildName = getPhoneticBuildName(buildName);
	var queryString = 'file=' + buildSound + '&speak=' + phoneticBuildName;
	var playPath = '/play';
	
	console.log('alerting for build: ' + buildName);
	console.log('spoken text for build: ' + phoneticBuildName);

	console.log('play path: ' + playPath + '?' + queryString);
	exec('curl -d "' + queryString + '" -X POST http://' + soundSysData.host + ':' + soundSysData.port + playPath, 
		function(error, stdout, stderr) {console.log(stdout);});

}

// Routes

app.get('/lastbuilds',function(req,res) {
	console.log('');
	console.log('status ping');
	console.log('');
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
	var triggeredBy = req.param('triggeredBy','');
	
	var failed = buildStatus.indexOf('FAILURE') > -1 || buildStatus.indexOf('Tests failed') > -1;
	
	console.log('');
	console.log('Time: ' + new Date());
	console.log('Triggered by: ' + triggeredBy);
	console.log('Build Status --------: ' + req.param('buildStatus','nostat'));
	console.log('Build Status Previous: ' + req.param('buildStatusPrevious','noprev'));

	//update last build status
	LastBuildStatus[buildName] = buildStatus;

	if(!failed) {
		console.log(currTime + 'Build succeeded: ' + buildInfo + buildPassTag);
		res.send('passed');
		return;
	}
	
	console.log(currTime + buildInfo + buildFailTag  + '<<<<<<<<<<<<');
	console.log('New Status: ' + buildStatus);

	// Alert with sound system
	var alertSound = brokenPersonalBuildSound;

	if (triggeredBy.indexOf('Team Foundation Server')  > -1 || triggeredBy.indexOf('Schedule Trigger')  > -1 || triggeredBy.indexOf('.Root') > -1) {
		alertSound = brokenBuildSound;
	}
	
	alertBrokenBuild(alertSound, buildName);
	
	res.send('failed');

	// Email to build flow
	var emailRecipient = 'build@daptiv.flowdock.com';

	console.log('[emailer] sending email to ' + emailRecipient);
	mailer.sendMail({
			from: 'teamcity@daptiv.com', // This must match credentials supplied in smtpData.json
			to: emailRecipient,
			subject: 'Broken Build: ' + buildName,
			html: req.toString()
		},
		function(err, status) {
			console.log('');
			console.log('[emailer] status:');
			console.log(status);
			console.log('[emailer] error:');
			console.log(err);
			console.log('[emailer] closing connection');
			mailer.close();
		});

});

app.listen(8001);
console.log("Build monitor listening on port %d in %s mode", app.address().port, app.settings.env);
