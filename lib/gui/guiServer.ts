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
///<reference path='../ts-declarations/node.d.ts' />
///<reference path='../ts-declarations/jalangi.d.ts' />
///<reference path='../ts-declarations/express.d.ts' />


// Author: Simon Jensen

import jalangi = require('jalangi/src/js/jalangi');
import path = require('path');
import express = require('express');
import types = require('./dataAnalysisTypes');

import timeAnalysis = require('./timeLine');
import accessPathApi = require("./lifetimeAnalysisAPI")
import fs = require("fs")
import Q = require("q")
import cp = require('child_process');
import lastUseTree = require("./lastUseTree")
import issueFinder = require('./issueFinder');
var ejs = require("ejs");

var argparse = require('argparse');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "GUI server for memory profiler"
});

parser.addArgument(['-P', '--port'], { help: "Port to serve on" });
parser.addArgument(['traceFile'], { help: "trace for app" });
parser.addArgument(['stalenessInfo'], { help: "JSON file containing staleness info" });
var args = parser.parseArgs();


var instOptions = {
    iidMap : true,
    serialize : true,
    relative: true
};

var file = args.traceFile;
var file2 = args.stalenessInfo;
var traceDirectory = path.dirname(path.resolve(file));
var port = args.port === null ? 9000 : parseInt(parser.port);
var trace : string;
var sizePromise : any;
var recordPromise : any = null;

if (file === undefined) {
    console.log("Must specify trace")
    process.exit(1)
}

if (file.indexOf(".json") !== -1) {
    console.log("Must specify trace and then the staleness .json file");
    process.exit(1)
}


trace = file;
if (file2.indexOf(".json") !== -1) {
    console.log("Reading Size and Staleness JSON file " + file2);
    sizePromise = Q.fcall (
        function () {
            var buf : NodeBuffer = fs.readFileSync(file2);
            var json : JSON = JSON.parse(buf.toString());
            return { result: json };
        });
} else {
    console.log("Expecting a .json file in the second argument");
    process.exit(1)
}

/**
 * parsed representation of site information from JSON file
 */
var objectSet : any;

/**
 * trace of function calls
 */
var ft : any;

var maxTime : number;
var origJson : any = undefined;
sizePromise.then(
    function (r : any) {
        console.log("Populating JSON objects");
        objectSet = timeAnalysis.populateObjectsFromJSON(r.result);
        console.log("...done");

        console.log("Populating function trace");
        ft = timeAnalysis.populateFunctionTraceFromJSON(r.result);
        //timeAnalysis.decorateObjectSet(objectSet, ft);
        // timeAnalysis.testFuncTimeLine(t);

        var max = 0;
        for (var i in ft) { // NOTE: assuming in order
            //console.log(i + ", " + ft[i].time);
            max = i;
        }
        maxTime = ft[max].time;
        origJson = r.result
        console.log("... done");

        return;
    }
).done();

function makeSummary() {
    if (recordPromise !== null) {
        return recordPromise.then(function (r : any) {
            return {name: r.traceFile}
        })
    } else {
        return Q.fcall(function () {
            return {name: file}
        })
    }
}

var app = express();
// setting this option makes generation of JSON more space-efficient
app.set('json spaces', undefined);
app.configure(function(){
    app.use(express.static(path.join(__dirname, '..', 'newGUI')));
});
var curObjectSet : any;

var enhOutputPromise = issueFinder.getEnhancedTraceOutput(path.join(traceDirectory, 'enhanced-trace'));

function extend(dst: any, src: any) {
    Object.keys(src).forEach((prop:string) => {
        dst[prop] = src[prop];
    })
}

function joinAndComputeMetrics(timelineOutput: timeAnalysis.SSDResult, enhOutput: any): any {
    var result: any = [];
    var objInfo = enhOutput.objectInfo;
    var timelineObjData = timelineOutput.summaryData;
    Object.keys(timelineObjData).forEach((site: string) => {
        var curResult:any = {};
        var curTimelineOutput = timelineObjData[site];
        var curEnhOutput = objInfo[site];
        if (curTimelineOutput) {
            extend(curResult, curTimelineOutput);
        }
        if (curEnhOutput) {
            extend(curResult, curEnhOutput);
        }
        // TODO add back abilty to report leaking DOM nodes
        curResult.leakiness = (curResult.isLeakingDefinitely && curResult.kind !== "DOM") ?
            curResult.aggregateMoment / timelineOutput.totalHeapMoment :
            0;
        if (curResult.consistentlyPointedBy !== undefined && curResult.kind === "OBJECT") {
            curResult.inlineBenefit = curResult.count / timelineOutput.totalAllocations;
        } else {
            curResult.inlineBenefit = 0;
        }
        curResult.stackAllocBenefit = (curResult.isNonEscaping && curResult.kind === "OBJECT") ?
            curResult.count / timelineOutput.totalAllocations :
            0;
        curResult.relativeStaleness = curResult.aggregateStaleness / timelineOutput.totalStaleness;
        result.push(curResult);
    });
    return result;
}

app.get("/summary", (req, res) =>{
    var timeOutput = timeAnalysis.computeSiteSummaryData(objectSet);
    curObjectSet = objectSet;
    enhOutputPromise.then((enhOutput: any) => {
        var merged = joinAndComputeMetrics(timeOutput, enhOutput);
        var result = res.json(merged);
        console.log("Serving summary");
        return result;
    });
});

var json : any;

app.get("/timeline/:site", (req,res) =>{
    var siteos : any = {};
    var site = req.params.site;
    //console.log(req.params.site);
    if (site === "*") { /* all sites */
        if (!curObjectSet) {
            curObjectSet = objectSet;
        }
        siteos = curObjectSet;
    } else if (site == "DOM") { /* all DOM sites */
        siteos = timeAnalysis.filterObjects(timeAnalysis.mkDOMFilter(), curObjectSet);
    } else { /* specific site */
        if (!curObjectSet) {
            curObjectSet = objectSet;
        }
        site = decodeURIComponent(site);
        siteos[site] = curObjectSet[site];
    }

    var ts = timeAnalysis.computeSampledTimeLine(siteos, ft, 0, maxTime); /* need to pass in start and end times */
    console.log("Sending timeline data for " + 0 + " to " + maxTime);

    json = siteos; // remember what object set we used, in case someone asks for size details

    return res.json(ts);
})

app.get("/sizedetails/:time/:staleOnly", (req,res) => {
    console.log("Asked for details at time " + req.params.time + " and stale? " + req.params.staleOnly);
    var time = req.params.time;
    var staleOnly : boolean = req.params.staleOnly === "true";
    if (staleOnly) {
        var ssd = timeAnalysis.computeSiteSummaryData(timeAnalysis.filterObjects(timeAnalysis.mkStaleFilter(time), json));
        return res.json(ssd);
    } else {
        var ssd = timeAnalysis.computeSiteSummaryData(timeAnalysis.filterObjects(timeAnalysis.mkTimeFilter(time), json));
        return res.json(ssd);
    }
})

app.get("/callingcontexts/:site", function (req, res) {
    var site = req.params.site;
    console.log("Asking for calling context tree on site " + site);
    var siteos : any = {};
    siteos[site] = objectSet[site];
    var ssd = timeAnalysis.computeSiteSummaryData(siteos);
    var b = ssd.summaryData[site].allocTree;
    return res.json(b);
});



app.get("/accesspaths", (req,res) => {
    var site = req.param("site");
    var time = req.param("time");
    console.log("Asked for access paths for site: " + site + " and time " + time);
    var objects = origJson["objectInfo"][site];
    objects  = objects.filter((obj : any) => {
        // for now, we filter out PROTOTYPE objects
        // TODO handle them properly
        return obj.creationTime <= time && obj.type !== 'PROTOTYPE';
    }).map((obj : any) => obj.objectId);
    //console.log(objects)
    console.log("Number of objects: " + objects.length);
    var pathsPromise = accessPathApi.getAccessPaths(objects, parseInt(time), trace);
    pathsPromise.then((paths) => {
        var b = timeAnalysis.analyzePaths(paths);
        return res.json(b);
    });
});

// just returns source code of file in JSON
// we assume the file location is given relative to the trace directory
app.get("/srcloc/:site", (req,res) => {
    var iid = decodeURIComponent(req.params.site);
    var filename = iid.split(':')[0];
    var file = path.join(traceDirectory,filename);
    console.log("Sending source file: " + file);
    fs.readFile(file, (err, data) => {
        if (err) {
            res.send(404, err);
            return;
        }
        res.json({ src: String(data) });
    });
});


function getAllocPageTemplate(): string {
    return String(fs.readFileSync(path.join("lib","newGUI","allocpage.template")));
}

function getProblemsTemplate(): string {
    return String(fs.readFileSync(path.join("lib","newGUI","problemspage.template")));
}


app.get("/allocpage/:site", (req, res) => {
    res.set('Content-Type', 'text/html');
    res.send(ejs.render(getAllocPageTemplate(), { site: decodeURIComponent(req.params.site)}));
});

app.get("/lastusetree", (req, res) => {
    var site = req.param("site")
    var time = parseInt(req.param("time"))
    sizePromise.then(function (r : any) {
        res.json(lastUseTree.computeTree(r.result, site, time))
    })
});

app.get("/problemslist", (req, res) => {
    enhOutputPromise.then((output) => {
        res.json(issueFinder.computeIssues(output));
    });
});

console.log("Serving on port " + port + ". Use Ctrl-C to close")
app.listen(port);
