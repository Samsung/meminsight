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
///<reference path='../ts-declarations/express.d.ts' />


// Author: Simon Jensen

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
parser.addArgument(['lifetimeDir'], { help: "directory containing lifetime analysis output for app" });
var args: { port: string; lifetimeDir: string } = parser.parseArgs();


var instOptions = {
    iidMap : true,
    serialize : true,
    relative: true
};

var traceDirectory = path.resolve(args.lifetimeDir);
var stalenessTrace = path.join(traceDirectory, 'staleness-trace');
var lastUseTrace = path.join(traceDirectory, 'lastuse-trace');
var unreachableTrace = path.join(traceDirectory, 'unreachable-trace');
var port = args.port === null ? 9000 : parseInt(args.port);
var trace : string;

if (!fs.existsSync(stalenessTrace)) {
    console.log("could not find staleness trace at " + stalenessTrace);
    process.exit(1);
}


/**
 * parsed representation of site information from JSON file
 */
var objectSet : {[site:string]: Array<types.ObjectRecord>};

var maxTime : number;

console.log("Populating objects from staleness trace");
var objectSetPromise = timeAnalysis.populateObjects(stalenessTrace);
objectSetPromise.then((r) => {
    objectSet = r.objSet;
    maxTime = r.maxTime;
    console.log("...done");
}).done();



var app = express();
// setting this option makes generation of JSON more space-efficient
app.set('json spaces', undefined);
app.configure(function(){
    app.use(express.static(path.join(__dirname, '..', 'newGUI')));
});
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
    enhOutputPromise.then((enhOutput: any) => {
        var merged = joinAndComputeMetrics(timeOutput, enhOutput);
        var result = res.json(merged);
        console.log("Serving summary");
        return result;
    });
});

app.get("/timeline/:site", (req,res) =>{
    var siteos : any = {};
    var site = req.params.site;
    //console.log(req.params.site);
    if (site === "*") { /* all sites */
        siteos = objectSet;
    } else if (site == "DOM") { /* all DOM sites */
        siteos = timeAnalysis.filterObjects(timeAnalysis.mkDOMFilter(), objectSet);
    } else { /* specific site */
        site = decodeURIComponent(site);
        siteos[site] = objectSet[site];
    }

    var ts = timeAnalysis.computeSampledTimeLine(siteos, 0, maxTime); /* need to pass in start and end times */
    console.log("Sending timeline data for " + 0 + " to " + maxTime);

    return res.json(ts);
});

app.get("/sizedetails/:time/:staleOnly", (req,res) => {
    console.log("Asked for details at time " + req.params.time + " and stale? " + req.params.staleOnly);
    var time = req.params.time;
    var staleOnly : boolean = req.params.staleOnly === "true";
    if (staleOnly) {
        var ssd = timeAnalysis.computeSiteSummaryData(timeAnalysis.filterObjects(timeAnalysis.mkStaleFilter(time), objectSet));
        return res.json(ssd);
    } else {
        var ssd = timeAnalysis.computeSiteSummaryData(timeAnalysis.filterObjects(timeAnalysis.mkTimeFilter(time), objectSet));
        return res.json(ssd);
    }
});

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
    var time = parseInt(req.param("time"));
    console.log("Asked for access paths for site: " + site + " and time " + time);
    var objects = objectSet[site];
    var relevantObjectIds  = objects.filter((obj) => {
        // for now, we filter out PROTOTYPE objects
        // TODO handle them properly
        return obj.creationTime <= time && obj.kind !== 'PROTOTYPE';
    }).map((obj) => obj.objectId);
    //console.log(objects)
    console.log("Number of objects: " + objects.length);
    var pathsPromise = accessPathApi.getAccessPaths(relevantObjectIds, time, trace);
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
//    var file = path.join(traceDirectory,filename);
    var file = filename;
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

//app.get("/lastusetree", (req, res) => {
//    var site = req.param("site")
//    var time = parseInt(req.param("time"))
//    sizePromise.then(function (r : any) {
//        res.json(lastUseTree.computeTree(r.result, site, time))
//    })
//});

app.get("/problemslist", (req, res) => {
    enhOutputPromise.then((output) => {
        res.json(issueFinder.computeIssues(output));
    });
});

console.log("Serving on port " + port + ". Use Ctrl-C to close")
app.listen(port);
