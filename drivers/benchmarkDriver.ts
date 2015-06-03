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




/**
 * Created by m.sridharan on 7/16/14.
 */

import fastStats = require('fast-stats');
import sloc = require('sloc');
var sh = require('execSync');
import path = require('path');
import jalangi = require('jalangi/src/js/jalangi');
import mkdirp = require('mkdirp');
import memTracer = require('../lib/analysis/memTraceAPI');
import wrench = require('wrench');
import assert = require('assert');

import fs = require('fs');
import Q = require('q');

var loggingAnalysis = path.join(__dirname,'..','bin','LoggingAnalysis.js');
var directDriver = path.join(__dirname, '../node_modules/jalangi/src/js/commands/direct2.js');
var lifetimeAnalysisScript = path.join(__dirname, '..', 'lifetime-analysis', 'build', 'install', 'lifetime-analysis', 'bin', 'lifetime-analysis');

var argparse = require('argparse');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "Command-line utility to run octane benchmarks"
});
parser.addArgument(['--outputDir'], { help:"directory in which to place instrumented files and traces.  " +
    "We create a new sub-directory for our output.", required:true });
parser.addArgument(['--verbose'], { help: "print verbose output", action:'storeTrue'});
parser.addArgument(['--noMemUsage'], { help: "don't measure memory usage", action:'storeTrue'});
parser.addArgument(['--timingRuns'], { help: "number of runs for instrumented app", defaultValue: 5});
parser.addArgument(['--enhancedRuns'], { help: "number of runs for generating enhanced trace", defaultValue: 3});
parser.addArgument(['--websocket'], { help: "use websocket-based logging", action:'storeTrue'});
parser.addArgument(['--runBench'], { help: "run a particular benchmark", action:'append'});
parser.addArgument(['benchDir'], { help: "directory holding octane benchmarks", nargs: 1 });
var args = parser.parseArgs();
var outputDir:string = path.resolve(args.outputDir);
var benchDir:string=  path.resolve(args.benchDir[0]);
var runBench:Array<string> = args.runBench;

var benchmarks = [
    "richards",
    "deltablue",
    "crypto",
    "raytrace",
    "earley-boyer",
    "regexp",
    "splay",
    "navier-stokes",
    "pdfjs",
    "gbemu",
    "code-load",
    "box2d",
    "zlib",
    "typescript"
];

var multiFileBench: {[benchname:string]: Array<string>} = {
    "gbemu": ["gbemu.js", "gbemu-part2.js"],
    "zlib": ["zlib.js", "zlib-data.js"]
};

var CS_CODE_ROOT = "/Users/m.sridharan/git-repos/benchmarks";

var CS_INPUT = "/Users/m.sridharan/git-repos/benchmarks/escodegen/test/3rdparty/jslex.js";

class CaseStudyBenchInfo {
    constructor(public inputFiles: string, public nodeArgs: Array<string>) {

    }
}

var cs_benchmarks: {[bench:string]: CaseStudyBenchInfo} = {
    //"escodegen": new CaseStudyBenchInfo("escodegen.js", ["bin/escodegen.js", CS_INPUT]),
    //"esprima": new CaseStudyBenchInfo("esprima.js", ["bin/esparse.js", "--loc", "--range", CS_INPUT]),
    //"eslint": new CaseStudyBenchInfo("lib:bin/eslint.js", ["bin/eslint.js", CS_INPUT])
};

function getCSInputFiles(bench: string) {
    var benchDir = path.join(CS_CODE_ROOT, bench);
    var prefixes = cs_benchmarks[bench].inputFiles.split(':');
    var files: Array<string> = wrench.readdirSyncRecursive(benchDir)
        .filter((file) => {
            return file.search(new RegExp(".js$")) !== -1 &&
                prefixes.some((prefix) => { return file.indexOf(prefix) === 0; });
        })
        .map((file) => { return path.join(benchDir, file)});
    return files;
}
var NUM_TIMING_RUNS = args.timingRuns;
var NUM_ENHANCED_RUNS = args.enhancedRuns;

function runOnNode(nodeArgs: Array<string>) {
    var cmd = "node --harmony " + nodeArgs.join(' ');
    //console.log(cmd);
    sh.exec(cmd);
    //console.log("done");
}

function getLOC(bench: string, caseStudy: boolean): number {
    var result = 0;
    var inputFiles: Array<string> = null;
    if (caseStudy) {
        inputFiles = getCSInputFiles(bench);
    } else {
        inputFiles = multiFileBench[bench];
        if (!inputFiles) {
            inputFiles = [bench + ".js"];
        }
    }
    inputFiles.forEach((file) => {
        var filePath = caseStudy ? file : path.join(benchDir,file);
        var contents = String(fs.readFileSync(filePath));
        result += sloc(contents, "js").source;
    });
    return result;
}
function runBenchNormal(bench:string, caseStudy: boolean) {
    var result = new fastStats.Stats();
    var nodeArgs: Array<string> = null, curDir: string = process.cwd();
    if (caseStudy) {
        nodeArgs = cs_benchmarks[bench].nodeArgs;
        var caseStudyDir = path.join(CS_CODE_ROOT,bench);
        process.chdir(caseStudyDir);
    } else {
        var benchPath = path.join(benchDir, bench + ".js");
        nodeArgs = [benchPath];
    }
    for (var i = 0; i < NUM_TIMING_RUNS; i++) {
        var time = Date.now();
        runOnNode(nodeArgs);
        result.push(Date.now() - time);
    }
    if (caseStudy) {
        process.chdir(curDir);
    }
    return result;
}

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
    if (args.noMemUsage) {
        return { minHeap: 0, maxHeap: 0 };
    }
//    var cliStr = ['node', '--harmony', '--trace-gc', memHarnessScript].concat(nodeArgs).join(' ');
    var cliStr = ['node', '--harmony', /*'--gc-global', */'--expose-gc', '--trace-gc'].concat(nodeArgs).join(' ');
//    console.log(cliStr);
    var result = sh.exec(cliStr);
//    console.log(result);
    return computeMinAndMaxHeap(result.stdout);
}

function getMemUsageNormal(bench: string, caseStudy: boolean): MemUsage {
    if (caseStudy) {
        var csBenchDir = path.join(CS_CODE_ROOT, bench);
        var curDir = process.cwd();
        process.chdir(csBenchDir);
        var result = getNodeMemUsage(cs_benchmarks[bench].nodeArgs);
        process.chdir(curDir);
        return result;
    } else {
        return getNodeMemUsage([path.join(benchDir, bench + ".js")]);
    }
}

function dummyResolvedPromise(): Q.Promise<any> {
    var d = Q.defer();
    d.resolve(null);
    return d.promise;
}

var analysisConfigNames = ["hiddenProp","allUses","allPutfields","best"];

function runWithDirectAndAnalysis(bench: string, outputDir: string, caseStudy: boolean) {
    var directResults = new fastStats.Stats();
    var analysisResults: Array<fastStats.Stats> = [];
    var numConfigs = analysisConfigNames.length;
    for (var i = 0; i < numConfigs; i++) {
        analysisResults[i] = new fastStats.Stats();
    }
    var curDir = process.cwd();
    var justDirectArgs: Array<string>, baseLoggingAnalysisArgs: Array<string>;
    if (caseStudy) {
        var csBenchInfo = cs_benchmarks[bench];
        var justDirectArgs = [directDriver].concat(csBenchInfo.nodeArgs);
    } else {
        var script = multiFileBench[bench] ? multiFileBench[bench][0] : bench + ".js";
        script = path.join(outputDir, script);
        justDirectArgs = [directDriver, script];
    }
    var baseLoggingAnalysisArgs = [
        directDriver,
        '--analysis', loggingAnalysis
    ];
    if (args.websocket) {
        baseLoggingAnalysisArgs.push('--initParam', 'appDir:' + outputDir);
    } else {
        baseLoggingAnalysisArgs.push('--initParam', 'syncFS:true');
    }
    var loggingConfigs: Array<Array<string>> = [];

    //// ascii FS
    //var asciiFSArgs = baseLoggingAnalysisArgs.slice(0);
    //asciiFSArgs.push('--initParam', 'asciiFS:true');
    //loggingConfigs.push(asciiFSArgs);
    //
    // hidden prop
    var hiddenPropArgs = baseLoggingAnalysisArgs.slice(0);
    hiddenPropArgs.push('--initParam', 'useHiddenProp:true');
    loggingConfigs.push(hiddenPropArgs);

    // log all uses
    var allUsesArgs = baseLoggingAnalysisArgs.slice(0);
    allUsesArgs.push('--initParam', 'allUses:true');
    loggingConfigs.push(allUsesArgs);

    // log all putfields
    var allPutfieldsArgs = baseLoggingAnalysisArgs.slice(0);
    allPutfieldsArgs.push('--initParam', 'allPutfields:true');
    loggingConfigs.push(allPutfieldsArgs);

    // base config
    // make sure the base, best config is last, to get proper trace size
    loggingConfigs.push(baseLoggingAnalysisArgs);
    // add the script argument to all configs at the end
    loggingConfigs.forEach((config: Array<string>) => {
        if (caseStudy) {
            Array.prototype.push.apply(config, csBenchInfo.nodeArgs);
        } else {
            config.push(script);
        }
    });
    assert(loggingConfigs.length === numConfigs);
    for (var i = 0; i < NUM_TIMING_RUNS; i++) {
        var start = Date.now();
        runOnNode(justDirectArgs);
        directResults.push(Date.now() - start);
        process.chdir(outputDir);
        for (var j = 0; j < numConfigs; j++) {
            start = Date.now();
            runOnNode(loggingConfigs[j]);
            analysisResults[j].push(Date.now() - start);
        }
        process.chdir(curDir);
    }
    var directMemUsage = getNodeMemUsage(justDirectArgs);
//    console.log(outputDir);
    process.chdir(outputDir);
    var analysisMemUsage: Array<MemUsage> = [];
    for (var i = 0; i < numConfigs; i++) {
        analysisMemUsage[i] = getNodeMemUsage(loggingConfigs[i]);
    }
    process.chdir(curDir);
    return {
        directStats: directResults,
        analysisStats: analysisResults,
        directMemUsage: directMemUsage,
        analysisMemUsage: analysisMemUsage
    };
}


function instrument(bench: string, caseStudy: boolean) {
    var start = Date.now(), promise: Q.Promise<jalangi.InstDirResult> = null,
        trueOutputDir: string;
    if (caseStudy) {
        var csBenchDir = path.join(CS_CODE_ROOT, bench);
        trueOutputDir = path.join(outputDir, bench);
        promise = memTracer.instrumentHTMLDir(csBenchDir, {
            outputDir: outputDir,
            only_include: cs_benchmarks[bench].inputFiles,
            verbose: args.verbose
        });
    } else {
        trueOutputDir = path.join(outputDir,bench+"_inst");
        mkdirp.sync(trueOutputDir);
//    var instScript = path.join(trueOutputDir, path.basename(script, '.js') + "_jalangi_.js");
        var inputFiles: Array<string> = multiFileBench[bench];
        if (!inputFiles) {
            inputFiles = [bench + ".js"];
        }
        inputFiles = inputFiles.map((file) => { return path.join(benchDir, file)});
        var instOptions = {
            outputDir: trueOutputDir,
            inputFiles: inputFiles,
            verbose: args.verbose
        };
        promise = memTracer.instrumentScriptsMem(inputFiles, instOptions);
    }
    return promise.then((): any => {
        var instTime = Date.now() - start;
        return { instTime: instTime, outputDir: trueOutputDir };
    });
}

function genEnhancedTrace(benchOutputDir: string): fastStats.Stats {
    var traceFile = path.join(benchOutputDir, 'mem-trace');
    var cliArgs = [
        lifetimeAnalysisScript,
        "--no-progress",
//        "--ref-trace",
        "--ref",
        "--trace",
        traceFile,
        ">",
        path.join(benchOutputDir, 'enhanced-trace')
    ];
    var cliStr = "export LIFETIME_ANALYSIS_OPTS=\" -Xmx2G -Dtesting=no\" && " + cliArgs.join(' ');
    var result = new fastStats.Stats();
    for (var i = 0; i < NUM_ENHANCED_RUNS; i++) {
        var time = Date.now();
        sh.run(cliStr);
        result.push(Date.now() - time);
    }
    return result;
}

function memUsageStr(memUsg: MemUsage) {
    return memUsg.minHeap.toFixed(1) + "MB--" + memUsg.maxHeap.toFixed(1) + "MB";
}

var benchPromise: Q.Promise<any> = dummyResolvedPromise();

class ConfigStats {
    constructor(public timingStats: fastStats.Stats, public memUsage: MemUsage) {

    }
}

interface BenchStats {
    normalStats: ConfigStats
    instTime: number
    loc: number
    justJalangiStats: ConfigStats
    analysisStats: Array<ConfigStats>
    traceSize: number
    enhancedTraceStats: fastStats.Stats
}

var bench2Stats: {[benchname:string]: BenchStats} = {};
var csBenchNames = Object.keys(cs_benchmarks);
var allBenchmarks = benchmarks.concat(csBenchNames);
allBenchmarks.forEach((bench: string) => {
    if (runBench && runBench.indexOf(bench) === -1) return;
    var caseStudyBench = csBenchNames.indexOf(bench) !== -1;
    benchPromise = benchPromise.then(() => {
        var normalStats: fastStats.Stats = runBenchNormal(bench, caseStudyBench);
        var loc = getLOC(bench, caseStudyBench);
        var heapUsage = getMemUsageNormal(bench, caseStudyBench);
        var instTime: number;
        var analysis2Stats: { stats: fastStats.Stats; memUsg: MemUsage };
        var benchOutputDir: string;
        var instPromise = instrument(bench, caseStudyBench);
        var directStatsPromise = instPromise.then((result) => {
            instTime = result.instTime;
            benchOutputDir = result.outputDir;
            return runWithDirectAndAnalysis(bench, benchOutputDir, caseStudyBench);
        });
        return directStatsPromise.then((s) => {
            var memTraceFile = path.join(benchOutputDir, 'mem-trace');
            var traceSize = fs.existsSync(memTraceFile) ? fs.statSync(memTraceFile).size : -1;
            var enhancedStats = genEnhancedTrace(benchOutputDir);
            var analysisConfigStats = [];
            s.analysisStats.forEach((stats: fastStats.Stats, index: number) => {
                analysisConfigStats.push(new ConfigStats(stats, s.analysisMemUsage[index]));
            });
            bench2Stats[bench] = {
                normalStats: new ConfigStats(normalStats, heapUsage),
                instTime: instTime,
                loc: loc,
                justJalangiStats: new ConfigStats(s.directStats, s.directMemUsage),
                analysisStats: analysisConfigStats,
                traceSize: traceSize,
                enhancedTraceStats: enhancedStats
            };
            console.log(bench);
            console.log("LOC " + loc);
            console.log("uninstrumented mean running time " + normalStats.amean().toFixed(2));
            console.log("uninstrumented heap usage " + memUsageStr(heapUsage));
            console.log("instrumentation time " + instTime);
            console.log("just instrumented mean running time " + s.directStats.amean().toFixed(2));
            console.log("just instrumented overhead " + (s.directStats.amean()/normalStats.amean()).toFixed(2) + "X");
            console.log("just instrumented heap usage " + memUsageStr(s.directMemUsage));
            analysisConfigNames.forEach((name: string, i: number) => {
                console.log(name + " logging analysis mean running time " + s.analysisStats[i].amean().toFixed(2));
                console.log(name + " logging analysis overhead " + (s.analysisStats[i].amean()/normalStats.amean()).toFixed(2) + "X");
                console.log(name + " logging analysis heap usage " + memUsageStr(s.analysisMemUsage[i]));
                console.log(name + " logging analysis overhead vs just instrumented " + (s.analysisStats[i].amean()/s.directStats.amean()).toFixed(2) + "X");
            });
            console.log("trace size " + (traceSize / 1000000.0).toFixed(2) + "MB");
            console.log("enhanced trace " + enhancedStats.amean().toFixed(2));
            console.log("====================================")
        });
    });
});

benchPromise.done();