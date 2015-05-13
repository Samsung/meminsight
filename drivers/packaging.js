var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var cp = require('child_process');

var Q = require('q');
var argparse = require('argparse');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "Command-line utility to generate memory trace"
});
parser.addArgument(['--outputDir'], { help: "directory in which to place instrumented files and traces.  " + "We create a new sub-directory for our output.", required: true });
parser.addArgument(['inputDir'], { help: "Either a JavaScript file or an HTML app directory with an index.html file" });


var args = parser.parseArgs();
var outputDir = args.outputDir;
var projectName = getProjectName(args.inputDir);
var targetProjectFile = path.join(outputDir, projectName, '/', '.project');
var signature1File = path.join(outputDir, projectName, '/', 'signature1.xml');
var authorSignatureFile = path.join(outputDir, projectName, '/', 'author-signature.xml');
var outputFile = path.join(outputDir, projectName + ".wgt");

// if(!fs.existsSync(targetProjectFile)){
// 	var sourceProjectFile = path.join(process.cwd(), '/tools/.project');
// 	fs.writeFileSync(targetProjectFile, fs.readFileSync(sourceProjectFile));
// 	console.log("==> default .project file is copied");
// }
if (fs.existsSync(targetProjectFile)) {
    fs.unlinkSync(targetProjectFile);
}
if(fs.existsSync(signature1File)){
	fs.unlinkSync(signature1File);
	console.log("==> existed " + signature1File + " is deleted");
}
if(fs.existsSync(authorSignatureFile)){
	fs.unlinkSync(authorSignatureFile);
	console.log("==> existed " + authorSignatureFile + " is deleted");
}
if(fs.existsSync(outputFile)){
	fs.unlinkSync(outputFile);
	console.log("==> existed " + outputFile + " is deleted");
}

//signing
var signProc = cp.spawn('web-signing', ["-n","-p","test1:tools/profiles.xml", args.inputDir]);
signProc.stdout.on('data', function (data) {
	process.stdout.write(String(data));
});
signProc.stderr.on('data', function (data) {
	process.stderr.write(String(data));
});
signProc.on('close', function (code) {
		if (code !== 0) {
			console.log("signing failed");
		}
		else {
			console.log("signing complete");
		}

		//packaging
		var instProc = cp.spawn('web-packaging', ["-n",outputFile, args.inputDir]);
		instProc.stdout.on('data', function (data) {
			process.stdout.write(String(data));
		});
		instProc.stderr.on('data', function (data) {
			process.stderr.write(String(data));
		});
		instProc.on('close', function (code) {
			if (code !== 0) {
				console.log("packaging  failed");
			}
			else {
				// un-install
				var uninstallProc = cp.spawn('web-uninstall', ['-i', getApplicationID()]);
				uninstallProc.stdout.on('data', function (data) {
					process.stdout.write(String(data));
				});
				uninstallProc.stderr.on('data', function (data) {
					process.stderr.write(String(data));
				});
				uninstallProc.on('close', function (code) {
					if (code !== 0) {
						console.log("uninstall failed");
					}
					else {
						console.log("uninstall complete");
					}
					console.log(projectName + " will be installed");
					var installProc = cp.spawn('sdb', ['install', outputFile]);
					installProc.stdout.on('data', function (data) {
						process.stdout.write(String(data));
					});
					installProc.stderr.on('data', function (data) {
						process.stderr.write(String(data));
					});
					installProc.on('close', function (code){
						if(code !== 0){
							console.log(projectName + " install failed");
						} else {
							console.log(projectName + " install complete");
						}
					});
				});
			}
		});
});

function getProjectName(inputDir){
	var len = inputDir.length;
	var tmpPath = inputDir;
	if(inputDir.charAt(len-1) === "/"){
		tmpPath = inputDir.substr(0, len-1);
	}
	
	var pathArr = tmpPath.split("/");
	return pathArr[pathArr.length - 1];
}


function getApplicationID(){
	var parseString = require('xml2js').parseString;
	var config = path.join(outputDir, projectName, '/', 'config.xml');
	var xml = fs.readFileSync(config);
	var id;
	parseString(xml, function (err, result) {
		id = result.widget['tizen:application'][0].$.id;
	});
	return id;
}
