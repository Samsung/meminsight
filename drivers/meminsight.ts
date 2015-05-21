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
import lifetimeAnalysis = require('./../lib/gui/lifetimeAnalysisAPI')
var argparse = require('argparse');



function runNodeProg(args: Array<string>, progName: string, cb?: (code: number) => void): void {
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
    if (!cb) {
        cb = (code: number) => {
            if (code !== 0) {
                console.log(progName + " failed");
            } else {
                console.log(progName + " complete");
            }
        };
    }
    instProc.on('close', cb);

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
    var stalenessTrace = path.join(appPath, 'staleness-trace');
    if (!fs.existsSync(stalenessTrace)) {
        console.error("no staleness trace from previous run present; exiting");
        process.exit(1);
    }
    // OK, we have the files.  run the GUI server
    var cliArgs = [
        path.join(__dirname, '..', 'lib', 'gui', 'guiServer.js'),
        appPath
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
    // dump traces in same directory as the instrumented script
    // TODO make this configurable
    var appPath = path.dirname(instScript);
    var curDir = process.cwd();
    process.chdir(appPath);
    console.log("running node.js script " + instScript);
    var loggingAnalysisArgs = [
        directDriver,
        '--analysis',
        loggingAnalysis,
        '--initParam',
        'syncFS:true',
        instScript].concat(instScriptArgs);
    runNodeProg(loggingAnalysisArgs, "run of script ", (code: number) => {
        if (code !== 0) {
            console.log("run of script failed");
            return;
        }
        console.log("run of script complete");
        // run the lifetime analysis
        var javaProc = lifetimeAnalysis.runLifetimeAnalysisOnTrace(path.join(appPath,'mem-trace'));
        javaProc.stdout.on("data", (chunk : any) => {
            console.log(chunk.toString());
        });
        javaProc.stderr.on("data", (chunk : any) => {
            console.error(chunk.toString());
        });
        javaProc.on("exit", () => {
            console.log("done with lifetime analysis");
        });

    });
}

var onTheFlyDriver = path.join(__dirname, '../node_modules/jalangi2/src/js/commands/jalangi.js');

/**
 * run memory analysis on node script using on-the-fly instrumentation
 * @param args
 */
function instAndRunNodeScript(args: Array<string>): void {
    var parser = new argparse.ArgumentParser({
        prog: "meminsight noderun",
        addHelp: true,
        description: "instrument a node.js script as it runs and collect profiling results"
    });
    parser.addArgument(['script'], { help: "path of script to run, relative to appPath"});
    parser.addArgument(['scriptArgs'], {
        help: "command-line arguments to pass to script",
        nargs: argparse.Const.REMAINDER
    });
    var parsed = parser.parseArgs(args);
    var script = path.resolve(parsed.script);
    var scriptArgs = parsed.scriptArgs;
    // dump traces in same directory as the instrumented script
    // TODO make this configurable
    var appPath = path.dirname(script);
    var curDir = process.cwd();
    process.chdir(appPath);
    console.log("running node.js script " + script);
    var loggingAnalysisArgs = [
        onTheFlyDriver,
        '--inlineIID',
        '--analysis',
        loggingAnalysis,
        '--initParam',
        'syncFS:true',
        '--astHandlerModule',
        path.join(__dirname, '..', 'lib', 'analysis', 'freeVarsAstHandler.js'),
        script].concat(scriptArgs);
    runNodeProg(loggingAnalysisArgs, "run of script ", (code: number) => {
        if (code !== 0) {
            console.log("run of script failed");
            return;
        }
        console.log("run of script complete");
        // run the lifetime analysis
        var javaProc = lifetimeAnalysis.runLifetimeAnalysisOnTrace(path.join(appPath,'mem-trace'));
        javaProc.stdout.on("data", (chunk : any) => {
            console.log(chunk.toString());
        });
        javaProc.stderr.on("data", (chunk : any) => {
            console.error(chunk.toString());
        });
        javaProc.on("exit", () => {
            console.log("done with lifetime analysis");
        });

    });

}

var args = process.argv.slice(2);
if (args.length === 0) {
    console.error("must provide a command: instrument, run, noderun, nodeinstrun, or inspect");
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
    case 'nodeinstrun':
        instAndRunNodeScript(args.slice(1));
        break;
    case 'inspect':
        inspectApp(args.slice(1));
        break;
    default:
        console.error("unknown command: choose one of instrument, run, noderun, nodeinstrun, or inspect");
        process.exit(1);
}