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
/// <reference path="../ts-declarations/jalangi.d.ts" />
/// <reference path="../ts-declarations/node.d.ts" />
/// <reference path="../ts-declarations/Q.d.ts" />


/**
 * Created by m.sridharan on 6/21/14.
 */

import jalangi = require('jalangi2')
import path = require('path');
import Q = require('q');
import child_process = require('child_process');
import fs = require('fs');

var loggingAnalysis = path.join(__dirname,'..','..','bin','LoggingAnalysis.js');
require('jalangi2/src/js/instrument/astUtil');

// initializes J$.memAnalysisUtils
require('./memAnalysisUtils');

declare var J$: any;

export var browserAnalysisFiles = [
    path.join(__dirname, '../../node_modules/escope/node_modules/estraverse/estraverse.js'),
    path.join(__dirname, '../../node_modules/escope/escope.js'),
    path.join(__dirname, 'memAnalysisUtils.js'),
    loggingAnalysis
];

export interface MemTraceResult {
    stdout: string
    stderr: string
    memTraceLoc: string
}


function getFreeVars(ast: any): any {
    var freeVarsTable = {};
    var na = J$.memAnalysisUtils;
    var curVarNames:any = null;
    var freeVarsHandler = (node: any, context: any) => {
        var fv:any = na.freeVars(node);
        curVarNames = fv === na.ANY ? "ANY" : Object.keys(fv);
    };
    var visitorPost = {
        'CallExpression': (node: any) => {
            if (node.callee.object && node.callee.object.name === 'J$' && (node.callee.property.name === 'Fe')) {
                var iid: any = node.arguments[0].value;
                freeVarsTable[iid] = curVarNames;
            }
            return node;
        }
    };
    var visitorPre = {
        'FunctionExpression': freeVarsHandler,
        'FunctionDeclaration': freeVarsHandler
    };
    J$.astUtil.transformAst(ast, visitorPost, visitorPre);
    return freeVarsTable;
}


export function instScriptAndGetMetadata(script: string, instOptions: jalangi.InstrumentOptions) {
    instOptions.instHandler = J$.memAnalysisUtils.instHandler;
    instOptions.astHandler = getFreeVars;
    var instResult = jalangi.instrumentString(script, instOptions);
    var code = instResult.code;
    return { instCode: code, iidSourceInfo: instResult.sourceMapObject };
}

export function instrumentScriptMem(script: string, instOptions: jalangi.InstrumentOptions): void {
    // let's assume we want to embed source maps for now
    instOptions.inlineSourceMap = true;
    var instResult = instScriptAndGetMetadata(script, instOptions);
    var outputFileName = instOptions.outputFile;
    fs.writeFileSync(outputFileName, instResult.instCode);
}

export function getTraceForJS(script: string, instOptions: jalangi.InstrumentOptions, debugFun?: string) {
    instOptions.inputFileName = script;
    instrumentScriptMem(String(fs.readFileSync(script)), instOptions);

    // run direct analysis
    var curDir = process.cwd();
    var outputDir = path.dirname(instOptions.outputFile);
    var otherOpts:any = debugFun ? { debugFun: debugFun } : {};
    otherOpts.syncFS = true;
    process.chdir(outputDir);
    var directPromise = jalangi.analyze(path.basename(instOptions.outputFile), [loggingAnalysis], otherOpts);
    var deferred = <Q.Deferred<MemTraceResult>>Q.defer();
    var handler = (result: jalangi.AnalysisResult) => {
        process.chdir(curDir);
        var memTraceResult = {
            stdout: result.stdout,
            stderr: result.stderr,
            memTraceLoc: path.join(outputDir, 'mem-trace')
        };
        deferred.resolve(memTraceResult);
    };
    // the direct promise is rejected when we get an error code from the child process.
    // but, this might just be due to an uncaught exception in the underlying program.
    // so, use the same handler for resolve and reject.  It's up to the caller to figure
    // out of there was a real problem
    directPromise.then(handler, handler);
    return deferred.promise;

}

export interface HTMLTraceOptions {
    outputDir?: string
    debugFun?: string
    verbose?: boolean
    syncAjax?: boolean
    only_include?: string
}

export function instrumentHTMLDir(testDir: string, options: HTMLTraceOptions, selenium?: boolean): Q.Promise<jalangi.InstDirResult> {
    var instOptions: any = {
        copy_runtime: true,
        inbrowser: true,
        analysis: browserAnalysisFiles,
        inputFiles: [testDir],
        inlineIID: true
    };
    if (options.outputDir) {
        instOptions.outputDir = options.outputDir;
    }
    if (options.debugFun || options.syncAjax) {
        instOptions.initParam = [];
        if (options.debugFun) {
            instOptions.initParam.push("debugFun:"+options.debugFun);
        }
        if (options.syncAjax) {
            instOptions.initParam.push("syncAjax:" + options.syncAjax);
        }
    }
    if (options.verbose) {
        instOptions.verbose = true;
    }
    if (options.only_include) {
        instOptions.only_include = options.only_include;
    }
    if (selenium) {
        instOptions.selenium = true;
    }
    instOptions.instHandler = J$.memAnalysisUtils.instHandler;
    instOptions.astHandler = getFreeVars;
    return jalangi.instrumentDir(instOptions);
}

export function getTraceForHTMLDir(testDir:string, options:HTMLTraceOptions):Q.Promise<MemTraceResult> {
    var instPromise = instrumentHTMLDir(testDir, options, true);
    // load instrumented code and generate trace
    var tracePromise = instPromise.then(function (result:jalangi.InstDirResult) {
        var outputDir = path.join(result.outputDir, path.basename(testDir));
        var deferred = <Q.Deferred<MemTraceResult>>Q.defer();
        // start up the server, which will just dump the mem trace
        var memTraceLoc = path.join(outputDir, 'mem-trace');
        var serverArgs = ['./lib/server/server.js', '--outputFile', memTraceLoc, outputDir];
        var serverProc = child_process.spawn('node', serverArgs, {
            cwd   : process.cwd(),
            env   : process.env,
            stdio : ['pipe', 'pipe', 'pipe']
        });
        var stdout = "", stderr = "";
        serverProc.stdout.on('data', (chunk: any) => {
            stdout += chunk.toString();
            // TODO fix this hack
            if (chunk.toString().indexOf("8080") !== -1) {
                // now fire up the phantomjs process to load the instrumented app
                child_process.exec(['phantomjs', './drivers/phantomjs-runner.js'].join(" "), function (error, stdout, stderr) {
                    if (error !== null) {
                        console.log(stdout); console.log(stderr);
                        deferred.reject(error);
                    }
                });
            }
        });
        serverProc.stderr.on('data', (chunk: any) => {
            stderr += chunk.toString();
        });
        serverProc.on('exit', () => {
            var memTraceResult = {
                stdout: stdout,
                stderr: stderr,
                memTraceLoc: memTraceLoc
            };
            deferred.resolve(memTraceResult);
        });
        serverProc.on('error', (err) => {
            deferred.reject(err);
        });
        return deferred.promise;
    });
    return tracePromise;

}

export function instrumentScriptsMem(scripts: Array<string>, options: HTMLTraceOptions): Q.Promise<jalangi.InstDirResult> {
    var instOptions: any = {
        copy_runtime: true,
        inbrowser: true,
        analysis: browserAnalysisFiles,
        inputFiles: scripts,
        inlineIID: true
    };
    if (options.outputDir) {
        instOptions.outputDir = options.outputDir;
    }
    if (options.debugFun || options.syncAjax) {
        instOptions.initParam = [];
        if (options.debugFun) {
            instOptions.initParam.push("debugFun:"+options.debugFun);
        }
        if (options.syncAjax) {
            instOptions.initParam.push("syncAjax:" + options.syncAjax);
        }
    }
    if (options.verbose) {
        instOptions.verbose = true;
    }
    if (options.only_include) {
        instOptions.only_include = options.only_include;
    }
    instOptions.instHandler = J$.memAnalysisUtils.instHandler;
    instOptions.astHandler = getFreeVars;
    return jalangi.instrumentDir(instOptions);

}