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
///<reference path='../lib/ts-declarations/jalangi.d.ts' />
///<reference path='../lib/ts-declarations/mkdirp.d.ts' />
///<reference path='../lib/ts-declarations/wrench.d.ts' />

/**
 * Created by m.sridharan on 6/16/14.
 */

import mkdirp = require('mkdirp');
import path = require('path');
import fs = require('fs');
import memTracer = require('../lib/analysis/memTraceAPI');
import Q = require('q');
var argparse = require('argparse');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "Command-line utility to generate memory trace"
});
parser.addArgument(['--debugFun'], { help: "function name for debug logging" });
parser.addArgument(['--only_include'], { help:"list of path prefixes specifying which sub-directories should be instrumented, separated by path.delimiter"});
parser.addArgument(['--syncAjax'], { help: "use synchronous AJAX calls for logging", action:'storeTrue' });
parser.addArgument(['--outputDir'], { help:"directory in which to place instrumented files and traces.  " +
                                           "We create a new sub-directory for our output.", required:true });
parser.addArgument(['--justGenerate'], { help: "just instrument and generate metadata, but don't produce mem-trace", action: 'storeTrue'});
parser.addArgument(['--verbose'], { help: "print verbose output", action:'storeTrue'});
parser.addArgument(['inputFile'], { help:"Either a JavaScript file or an HTML app directory with an index.html file" });
var args = parser.parseArgs();
var outputDir:string = args.outputDir;

var jsFile: boolean = !fs.statSync(args.inputFile).isDirectory();
var promise : Q.Promise<any>, trueOutputDir: string;
if (jsFile) {
    var script = args.inputFile;
    trueOutputDir = path.join(outputDir,path.basename(script, '.js')+"_inst");
    mkdirp.sync(trueOutputDir);
    var instScript = path.join(trueOutputDir, path.basename(script, '.js') + "_jalangi_.js");
    var instOptions = {
        outputFile: instScript,
        inputFileName: path.resolve(script)
    };
    if (args.justGenerate) {
        memTracer.instrumentScriptMem(String(fs.readFileSync(script)), instOptions);
        promise = Q(null);
    } else {
        promise = memTracer.getTraceForJS(script, instOptions, args.debugFun);
    }
} else { // HTML app dir
    var inputDirName = args.inputFile;
    if (args.justGenerate) {
        promise = memTracer.instrumentHTMLDir(inputDirName, {
            outputDir: outputDir,
            debugFun: args.debugFun,
            verbose: args.verbose,
            syncAjax: args.syncAjax,
            only_include: args.only_include
        }, false);
    } else {
        if (args.syncAjax) {
            throw new Error("must use syncAjax flag along with justGenerate flag");
        }
        promise = memTracer.getTraceForHTMLDir(inputDirName, {
            outputDir: outputDir,
            debugFun: args.debugFun,
            verbose: args.verbose
        });
    }
    trueOutputDir = path.join(outputDir, path.basename(inputDirName));
}

promise.then((result) => {
    if (result && result.stdout) {
        console.log(result.stdout);
    }
    if (result && result.stderr) {
        console.log("error output: ");
        console.log(result.stderr);
    }
}).done();






