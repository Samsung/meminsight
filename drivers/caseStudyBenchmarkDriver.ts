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
///<reference path='../lib/ts-declarations/fast-stats.d.ts' />
///<reference path='../lib/ts-declarations/mkdirp.d.ts' />
///<reference path='../lib/ts-declarations/wrench.d.ts' />
///<reference path='../lib/ts-declarations/sloc.d.ts' />

import fastStats = require('fast-stats');
import fs = require('fs');
import path = require('path');
import sloc = require('sloc');
import jalangi = require('jalangi/src/js/jalangi');
import mkdirp = require('mkdirp');
import wrench = require('wrench');
import memTracer = require('../lib/analysis/memTraceAPI');
import Q = require('q');

var sh = require('execSync');

var argparse = require('argparse');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "Command-line utility to run octane benchmarks"
});
parser.addArgument(['--outputDir'], { help:"directory in which to place instrumented files and traces.  " +
    "We create a new sub-directory for our output.", required:true });
parser.addArgument(['--verbose'], { help: "print verbose output", action:'storeTrue'});

var args = parser.parseArgs();
var outputDir:string = path.resolve(args.outputDir);

var directDriver = path.join(__dirname, '../node_modules/jalangi/src/js/commands/direct2.js');
var loggingAnalysis = path.join(__dirname,'..','lib','analysis','LoggingAnalysis.js');
var memAnalysisJar = path.join(__dirname, '..', '..', 'memory-analysis-v2', 'build', 'libs', 'memory-analysis-v2-all.jar');


var NUM_TIMING_RUNS = 5;
var NUM_ENHANCED_RUNS = 3;

function runOnNode(nodeArgs: Array<string>) {
    sh.exec("node --harmony " + nodeArgs.join(' '));
}

var CODE_ROOT = "/Users/m.sridharan/git-repos/benchmarks";

var INPUT = "/Users/m.sridharan/git-repos/escodegen/test/3rdparty/jslex.js";

class BenchInfo {
    constructor(public inputFiles: string, public nodeArgs: Array<string>) {

    }
}
var benchmarks: {[bench:string]: BenchInfo} = {
    "escodegen": new BenchInfo("escodegen.js", ["bin/escodegen.js", INPUT]),
    "esprima": new BenchInfo("esprima.js", ["bin/esparse.js", "--loc", "--range", INPUT]),
    "eslint": new BenchInfo("lib:bin/eslint.js", ["bin/eslint.js", INPUT])
};

interface MemUsage {
    minHeap: number
    maxHeap: number
}
function computeMinAndMaxHeap(output: string): MemUsage {
    var minHeap = -1, maxHeap = -1;
    var lines = output.split('\n');
    var gcLineMatcher = /(.*)ms: [\w-]+ ([\d.]+) \([\d.]+\) -> ([\d.]+) \([\d.]+\) MB/;
    lines.forEach((line) => {
        var result = gcLineMatcher.exec(line);
        if (result) {
            var before = parseFloat(result[2]);
            if (before > maxHeap) {
                maxHeap = before;
            }
            var after = parseFloat(result[3]);
            if (after > minHeap) {
                minHeap = after;
            }
        }
    });
    return { minHeap: minHeap, maxHeap: maxHeap };
}

var memHarnessScript = path.join(__dirname, 'memHarness.js');

function getNodeMemUsage(nodeArgs: Array<string>): MemUsage {
    var cliStr = ['node', '--harmony', '--gc-global', '--expose-gc', '--trace-gc', memHarnessScript].concat(nodeArgs).join(' ');
    var result = sh.exec(cliStr);
    return computeMinAndMaxHeap(result.stdout);
}

function getInputFiles(bench: string) {
    var benchDir = path.join(CODE_ROOT, bench);
    var prefixes = benchmarks[bench].inputFiles.split(':');
    var files: Array<string> = wrench.readdirSyncRecursive(benchDir)
        .filter((file) => {
                return file.search(new RegExp(".js$")) !== -1 &&
                    prefixes.some((prefix) => { return file.indexOf(prefix) === 0; });
            })
        .map((file) => { return path.join(benchDir, file)});
    return files;
}
function getLOC(bench: string) {
    var result = 0;
    var inputFiles: Array<string> = getInputFiles(bench);
    inputFiles.forEach((file) => {
        var contents = String(fs.readFileSync(file));
        result += sloc(contents, "js").source;
    });
    return result;
}

function runBenchNormal(bench:string) {
    var result = new fastStats.Stats();
    var benchDir = path.join(CODE_ROOT, bench);
    var curDir = process.cwd();
    process.chdir(benchDir);
    var benchArgs = benchmarks[bench].nodeArgs;
    for (var i = 0; i < NUM_TIMING_RUNS; i++) {
        var time = Date.now();
        runOnNode(benchArgs);
        result.push(Date.now() - time);
    }
    process.chdir(curDir);
    return result;
}

function getMemUsageNormal(bench: string): MemUsage {
    var benchDir = path.join(CODE_ROOT, bench);
    var curDir = process.cwd();
    process.chdir(benchDir);
    var result = getNodeMemUsage(benchmarks[bench].nodeArgs);
    process.chdir(curDir);
    return result;
}

function instrument(bench: string) {
    var start = Date.now();
    var benchDir = path.join(CODE_ROOT, bench);
    var promise = memTracer.instrumentHTMLDir(benchDir, {
        outputDir: outputDir,
        only_include: benchmarks[bench].inputFiles,
        verbose: args.verbose
    });
    var trueOutputDir = path.join(outputDir,bench);
    return promise.then((): any => {
        var instTime = Date.now() - start;
        return { instTime: instTime, outputDir: trueOutputDir };
    });
}

function runWithDirectAndAnalysis(bench: string, outputDir: string) {
    var directResults = new fastStats.Stats();
    var analysisResults = new fastStats.Stats();
    var curDir = process.cwd();
    var benchInfo = benchmarks[bench];
    var justDirectArgs = [directDriver].concat(benchInfo.nodeArgs);
    var loggingAnalysisArgs = [
        directDriver,
        '--analysis',
        loggingAnalysis,
        '--initParam', 'syncFS:true'
    ].concat(benchInfo.nodeArgs);
    process.chdir(outputDir);
    for (var i = 0; i < NUM_TIMING_RUNS; i++) {
        var start = Date.now();
        runOnNode(justDirectArgs);
        directResults.push(Date.now() - start);
        start = Date.now();
        runOnNode(loggingAnalysisArgs);
        analysisResults.push(Date.now() - start);
    }
    var directMemUsage = getNodeMemUsage(justDirectArgs);
    var analysisMemUsage = getNodeMemUsage(loggingAnalysisArgs);
    process.chdir(curDir);
    return {
        directStats: directResults,
        analysisStats: analysisResults,
        directMemUsage: directMemUsage,
        analysisMemUsage: analysisMemUsage
    };
}

class ConfigStats {
    constructor(public timingStats: fastStats.Stats, public memUsage: MemUsage) {

    }
}

function memUsageStr(memUsg: MemUsage) {
    return memUsg.minHeap.toFixed(1) + "MB--" + memUsg.maxHeap.toFixed(1) + "MB";
}

function genEnhancedTrace(bench: string, benchOutputDir: string): fastStats.Stats {
    var traceFile = path.join(benchOutputDir, 'mem-trace');
    var cliArgs = [
        "java",
        "-jar",
        memAnalysisJar,
        "--no-progress",
        "--ref-trace",
        "--trace",
        traceFile,
        ">",
        path.join(benchOutputDir, 'enhanced-trace')
    ];
    var cliStr = cliArgs.join(' ');
    var result = new fastStats.Stats();
    for (var i = 0; i < NUM_ENHANCED_RUNS; i++) {
        var time = Date.now();
        sh.run(cliStr);
        result.push(Date.now() - time);
    }
    return result;
}


interface BenchStats {
    normalStats: ConfigStats
    instTime: number
    loc: number
    justJalangiStats: ConfigStats
    analysisStats: ConfigStats
    traceSize: number
    enhancedTraceStats: fastStats.Stats
}

function dummyResolvedPromise(): Q.Promise<any> {
    var d = Q.defer();
    d.resolve(null);
    return d.promise;
}
var benchPromise: Q.Promise<any> = dummyResolvedPromise();
var bench2Stats: {[benchname:string]: BenchStats} = {};

Object.keys(benchmarks).forEach((bench) => {
    benchPromise = benchPromise.then(() => {
        console.log(bench);
        var loc = getLOC(bench)
        console.log("LOC " + loc);
        var normalStats: fastStats.Stats = runBenchNormal(bench);
        var heapUsage = getMemUsageNormal(bench);
        console.log("uninstrumented mean running time " + normalStats.amean().toFixed(2));
        console.log("uninstrumented heap usage " + memUsageStr(heapUsage));
        var instPromise = instrument(bench);
        var instTime: number, benchOutputDir: string;
        var directStatsPromise = instPromise.then((result) => {
            instTime = result.instTime;
            benchOutputDir = result.outputDir;
            console.log("instrumentation time " + instTime);
            return runWithDirectAndAnalysis(bench, benchOutputDir);
        });
        return directStatsPromise.then((s) => {
            var traceSize = fs.statSync(path.join(benchOutputDir, 'mem-trace')).size;
            var enhancedStats = genEnhancedTrace(bench, benchOutputDir);
            bench2Stats[bench] = {
                normalStats: new ConfigStats(normalStats, heapUsage),
                instTime: instTime,
                loc: loc,
                justJalangiStats: new ConfigStats(s.directStats, s.directMemUsage),
                analysisStats: new ConfigStats(s.analysisStats, s.analysisMemUsage),
                traceSize: traceSize,
                enhancedTraceStats: enhancedStats
            };
            console.log("just instrumented mean running time " + s.directStats.amean().toFixed(2));
            console.log("just instrumented overhead " + (s.directStats.amean()/normalStats.amean()).toFixed(2) + "X");
            console.log("just instrumented heap usage " + memUsageStr(s.directMemUsage));
            console.log("logging analysis mean running time " + s.analysisStats.amean().toFixed(2));
            console.log("logging analysis overhead " + (s.analysisStats.amean()/normalStats.amean()).toFixed(2) + "X");
            console.log("logging analysis heap usage " + memUsageStr(s.analysisMemUsage));
            console.log("logging analysis overhead vs just instrumented " + (s.analysisStats.amean()/s.directStats.amean()).toFixed(2) + "X");
            console.log("trace size " + (traceSize / 1000000.0).toFixed(2) + "MB");
            console.log("enhanced trace " + enhancedStats.amean().toFixed(2));
            console.log("====================================")
        });

    });
});

benchPromise.done();
