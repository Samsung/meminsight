/*
 * Copyright (c) 2014 Samsung Electronics Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
///<reference path='../lib/ts-declarations/node.d.ts' />

/**
 * Created by m.sridharan on 10/10/14.
 */

import cp = require('child_process');
import path = require('path');
import fs = require('fs');
var argparse = require('argparse');



function runNodeProg(args: Array<string>, progName: string): void {
    // always run in harmony mode
    args.unshift('--harmony');
    //console.log("node " + args.join(' '));
    var instProc = cp.spawn('node', args);
    instProc.stdout.on('data', (data: any) => {
        process.stdout.write(String(data));
    });
    instProc.stderr.on('data', (data: any) => {
        process.stderr.write(String(data));
    });
    instProc.on('close', (code: number) => {
        if (code !== 0) {
            console.log(progName + " failed");
        } else {
            console.log(progName + " complete");
        }
    });

}
function instrumentApp(args: Array<string>): void {
    var parser = new argparse.ArgumentParser({
        prog: "meminsight instrument",
        addHelp: true,
        description: "instrument a local application"
    });
    parser.addArgument(['--outputDir'], { help:"directory in which to place instrumented files and traces.  " +
    "We create a new sub-directory for our output.", defaultValue: "/tmp" });
    parser.addArgument(['--only_include'], { help:"list of path prefixes specifying which sub-directories should be instrumented, separated by path.delimiter"});
    parser.addArgument(['path'], { help:"directory of app to instrument" });
    var parsed = parser.parseArgs(args);
    var appPath = parsed.path;
    var outputDir = parsed.outputDir;

    console.log("instrumenting app " + appPath);
    if (!fs.existsSync(appPath)) {
        console.error("path " + appPath + " does not exist");
        process.exit(1);
    }
    var cliArgs = [
        path.join(__dirname, 'memTraceDriver.js'),
        '--justGenerate',
        '--verbose',
        '--outputDir',
        outputDir
    ];
    if (parsed.only_include) {
        cliArgs.push('--only_include', parsed.only_include);
    }
    cliArgs.push(appPath);
    runNodeProg(cliArgs, "instrumentation");
}

function runApp(args: Array<string>): void {
    var parser = new argparse.ArgumentParser({
        prog: "meminsight run",
        addHelp: true,
        description: "run an instrumented web app and collect profiling results"
    });
    parser.addArgument(['path'], { help:"directory of instrumented app" });
    var parsed = parser.parseArgs(args);
    var appPath = parsed.path;
    console.log("running app " + appPath);
    if (!fs.existsSync(appPath)) {
        console.error("path " + appPath + " does not exist");
        process.exit(1);
    }
    var cliArgs = [
        path.join(__dirname, '..', 'lib', 'server', 'server.js'),
        appPath
    ];
    runNodeProg(cliArgs, "run of app ");
}

function inspectApp(args: Array<string>): void {
    var parser = new argparse.ArgumentParser({
        prog: "meminsight inspect",
        addHelp: true,
        description: "inspect results of a previous profiling run"
    });
    parser.addArgument(['path'], { help:"directory of instrumented app" });
    var parsed = parser.parseArgs(args);
    var appPath = parsed.path;

    console.log("inspecting previous run of app " + appPath);
    if (!fs.existsSync(appPath)) {
        console.error("path " + appPath + " does not exist");
        process.exit(1);
    }
    // in order to inspect, we must have a staleness.json and
    // enhanced-trace file present
    var stalenessJSONPath = path.join(appPath, 'staleness.json');
    if (!fs.existsSync(stalenessJSONPath)) {
        console.error("no staleness.json from previous run present; exiting");
        process.exit(1);
    }
    var enhancedTracePath = path.join(appPath, 'enhanced-trace');
    if (!fs.existsSync(enhancedTracePath)) {
        console.error("no enhanced-trace from previous run present; exiting");
        process.exit(1);
    }
    // OK, we have the files.  run the GUI server
    var cliArgs = [
        path.join(__dirname, '..', 'lib', 'gui', 'guiServer.js'),
        enhancedTracePath,
        stalenessJSONPath
    ];
    runNodeProg(cliArgs, "inspect of app ");
}

var directDriver = path.join(__dirname, '../node_modules/jalangi2/src/js/commands/direct.js');
var loggingAnalysis = path.join(__dirname,'..','bin','LoggingAnalysis.js');
function runNodeScript(args: Array<string>): void {
    var parser = new argparse.ArgumentParser({
        prog: "meminsight noderun",
        addHelp: true,
        description: "run an instrumented node.js script and collect profiling results"
    });
    parser.addArgument(['instScript'], { help: "path of instrumented script to run, relative to appPath"});
    parser.addArgument(['instScriptArgs'], {
        help: "command-line arguments to pass to instrumented script",
        nargs: argparse.Const.REMAINDER
    });
    var parsed = parser.parseArgs(args);
    var instScript = parsed.instScript;
    var instScriptArgs = parsed.instScriptArgs;
    // discover the app path, which contains jalangi_sourcemap.json; must be a parent of the instScript directory
    //var appPath: string = null, curDir = path.dirname(instScript);
    //var root = (require('os').platform == "win32") ? process.cwd().split(path.sep)[0] : "/";
    //while (curDir !== root) {
    //    if (fs.existsSync(path.join(curDir, 'jalangi_sourcemap.json'))) {
    //        appPath = curDir;
    //        break;
    //    } else {
    //        curDir = path.resolve(curDir, '..');
    //    }
    //}
    //if (!appPath) {
    //    console.error("could not find root directory of instrument app, containing jalangi_sourcemap.json");
    //    process.exit(1);
    //}
    // TODO this is a temporary hack!!!
    var appPath = path.dirname(instScript);
    console.log("running node.js script " + instScript);
    var loggingAnalysisArgs = [
        directDriver,
        '--analysis',
        loggingAnalysis,
        '--initParam',
        'appDir:'+appPath,
        instScript].concat(instScriptArgs);
    runNodeProg(loggingAnalysisArgs, "run of script ");
}

var args = process.argv.slice(2);
if (args.length === 0) {
    console.error("must provide a command: instrument, run, noderun, or inspect");
    process.exit(1);
}
switch (args[0]) {
    case 'instrument':
        instrumentApp(args.slice(1));
        break;
    case 'run':
        runApp(args.slice(1));
        break;
    case 'noderun':
        runNodeScript(args.slice(1));
        break;
    case 'inspect':
        inspectApp(args.slice(1));
        break;
    default:
        console.error("unknown command: choose one of instrument, run, noderun, or inspect");
        process.exit(1);
}