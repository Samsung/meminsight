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
/// <reference path="../ts-declarations/jalangi.d.ts" />

//import fs = require ("fs");
import types = require('./dataAnalysisTypes');
import jalangi = require('jalangi/src/js/jalangi');
import path = require('path');

import tree = require('./tree');

enum Thresholds { VeryStale = 200000, NumBars = 500 };

enum FunEvents { Enter = 1, Exit = -1};

// TODO this should be passed as a parameter!
var inputFile = process.argv[2];

console.log ("Input file is: " + inputFile);

//var buf : NodeBuffer = fs.readFileSync(inputFile);

//var inp : string = buf.toString();

//var objectSet : any = populateObjects(inp);

//var ctl : any = computeCumulativeTimeLine(objectSet);

//var ssd : any = computeSiteSummaryData(filterObjects(mkTimeFilter(ctl.timeAtMaxAlloc), objectSet));

//printSiteSummaryData(ssd);

var refCountAnalysis = path.resolve("lib/SizeAndStalenessEngine.js");
var replayPromise = jalangi.replay(inputFile, refCountAnalysis, {});

var objectSetPromise = replayPromise.then(function (r : any) {
        return populateObjectsFromJSON(r.result);
    });

var siteSummaryDataPromiseMaker = function (osP : any) {
    // assume it is objectSetPromise
    return osP.then(function (r : any) {
        var ssd = computeSiteSummaryData(r);
        return filterSites(hasManyStales, ssd);
    });
};

var timeLinePromiseMaker = function (osP : any) {
    // assume it is objectSetPromise
    return osP.then(function (r : any) {
        return computeCumulativeTimeLine(r);
    });
};

var objectsAtSiteAtTimePromiseMaker = function (osP : any, time : any, site : any) {
    // assume it is objectSetPromise
    return osP.then(function (r: any) {
        var result : any = [];
        var objs = filterObjects(mkTimeFilter(time), r);
        if (objs[site] != undefined) {
            result = objs[site];
        }
        return result;
    });
};

/* --- "DRIVERS" ---(pick one) - */

// siteSummaryDataPromiseMaker(objectSetPromise).done(function (r) { printSiteSummaryData(r);});

/*timeLinePromiseMaker(objectSetPromise).done(
    function (r) {
        printCumulativeTimeLine(r);
    }
);*/


/*---------- OBJECTSET ------------ */
/*
 Object set is a map
   site -> array of ObjectRecord
   The site information in the object records for a site contains the site identity (redundantly?)
 */

export function populateObjectsFromJSON(jsonObject : any) : any {
    var objectSet : any = {};
    for (var e in jsonObject["objectInfo"]) {
        //console.log(e);
        var ks = jsonObject["objectInfo"][e];
        objectSet[e] = [];
        for (var k in ks) {
            var or : types.ObjectRecord = new types.ObjectRecord(
                e.toString(),
                ks[k].type,
                ks[k].creationTime,
                ks[k].unreachableTime,
                ks[k].shallowSize,
                /* ks[k].freeableSize, */
                ks[k].staleness,
                ks[k].unreachableTime - ks[k].staleness,
                /* ks[k].leastChildStaleness, */
                [],
                ks[k].creationCallStack
            )
            objectSet[e].push(or);
        }
    }

    return objectSet;
};

export function populateFunctionTraceFromJSON(jsonObject : any) : any {
    var functionTrace : any = [];
    for (var e in jsonObject["functionTrace"]) {
        var rec = jsonObject["functionTrace"][e];
        // console.log(rec);
        var fr = { "kind" : parseInt(rec[0]), "time" : parseInt(rec[1]), "IID" : parseInt(rec[2]) };
        functionTrace.push(fr);
    }
    return functionTrace;
}

function populateObjects(inp: string) : any {
    return populateObjectsFromJSON(JSON.parse(inp));
}

export function filterObjects(filter : any, objectSet : any) : any {
    var ret : any = {};
    var skipped : number = 0;
    var accepted : number = 0;
    for (var e in objectSet) {
        var ks = objectSet[e];
        var objects_in_e : any = [];
        var empty : boolean = true;
        for (var k in ks) {
            if (filter(ks[k])) {
                objects_in_e.push(ks[k]);
                empty = false;
                accepted = accepted + 1;
            } else {
                skipped = skipped + 1;
            }
        }
        if (! empty) {
            ret[e] = objects_in_e;
        }
    }
    console.log("Filter skipped " + skipped + ", accepted " + accepted);
    return ret;
}

export function mkDOMFilter() : any {
    return function (o : types.ObjectRecord) : boolean {
        return (o.kind == "DOM");
    }
}

export function mkTimeFilter(t : number) : any {
    return function (o: types.ObjectRecord) : boolean {
        /* is the object reachable at that time */
        return (o.creationTime <= t && t <= o.unreachableTime);
    }
}

export function mkStaleFilter(t : number) : any {
    return function (o: types.ObjectRecord) : boolean {
        /* is the object stale at that time */
        return (o.lastUseTime <= t && t <= o.unreachableTime);
    }
}

export function printObjects(objectSet : any) : any {
    for (var e in objectSet) {
        var ks = objectSet[e];
        for (var k in ks) {
            console.log(e + ", " + ks[k].creationTime + ", " + ks[k].lastUseTime + ", " + ks[k].unreachableTime);
        }
    }
}

export function timeToUnreachability(from : number, objectCreationTime: number, objectSet : any) : number {
    for (var e in objectSet) {
        var ks = objectSet[e];
        for (var k in ks) {
            if (ks[k].creationTime == objectCreationTime) {
                return ks[k].unreachableTime - from;
            }
        }
    }
    console.log("Object created at time " + objectCreationTime + " not found.");
    return 0; /* exceptional value -- should we actually throw an exception */
}

/*------- TIME LINE ---------*/
/*
timeline is a map from timestamps to {alloc, stale}
{timeline, maxAllocTime, stalenessAtMaxAlloc}
 */

function computeTimeLine(objectSet: any) : any {
    var timeLine : Array<types.Pair> = [];
    for (var e in objectSet) {
        var ks = objectSet[e];
        for (var k in ks) {
            var cT : number = ks[k].creationTime;
            var uT : number = ks[k].unreachableTime;
            var s : number = ks[k].staleness;
            var luT : number = uT - s;
            var sz : number = ks[k].shallowSize;
            sz = 1; // Assume unit size for now
            // cT <= luT < uT
            if (timeLine[cT] == undefined) {
                timeLine[cT] = new types.Pair(sz,0);
            } else {
                timeLine[cT].alloc += sz;
            }
            if (timeLine[luT] == undefined) {
                timeLine[luT] = new types.Pair(0,sz);
            } else {
                timeLine[luT].stale += sz;
            }
            if (timeLine[uT] == undefined) {
                timeLine[uT] = new types.Pair(-1*sz,-1*sz);
            } else {
                timeLine[uT].alloc += -1*sz;
                timeLine[uT].stale += -1*sz;
            }
        }
    }
    return timeLine;
}


export function printTimeLine(timeLine : any) : void {
    console.log("time, alloc, stale");
    for (var k in timeLine) {
        console.log(k + ", " + timeLine[k].alloc + ", " + timeLine[k].stale);
    }
}

function computeFunctionTimeLine(functionTrace: any) {
    var funcTimeLine : Array<types.FunRec> = [];
    for (var k in functionTrace) {
        var kind : number = functionTrace[k].kind;
        var time : number = functionTrace[k].time;
        var iid : number = functionTrace[k].IID;
        var fkind : number = (kind == 0) ? FunEvents.Enter : FunEvents.Exit;
        // time stamps in function trace will be unique
        funcTimeLine[time] = new types.FunRec(iid, fkind);
    }
    return funcTimeLine;
}

function computeCumulativeFuncTimeLine(functionTrace: any) {
    var funcTimeLine = computeFunctionTimeLine(functionTrace);

    var cumFuncTimeLine : Array<number> = [];
    var stackDepth : number = 0;

    for (var k in funcTimeLine) { /* NOTE: relies on time sorted order */
        stackDepth += funcTimeLine[k].kind;
        cumFuncTimeLine[k] = stackDepth; // TODO: need to package in the execution context too
    }

    return cumFuncTimeLine;
}

function printCumulativeFuncTimeLine(cumFuncTimeLine : Array<number>) {
    for (var k in cumFuncTimeLine) {
        console.log(k + ", " + cumFuncTimeLine[k])
    }
}

export function testFuncTimeLine(functionTrace : any) {
    var f = computeCumulativeFuncTimeLine(functionTrace);
    printCumulativeFuncTimeLine(f);
}


function computeCumulativeTimeLine(objectSet : any) : any {
    var timeLine = computeTimeLine(objectSet);
    var cumTimeLine : any = [];
    var sumAlloc : number = 0;
    var sumStale : number = 0;
    var maxAlloc : number = 0;
    var staleAtMaxAlloc : number = 0;
    var timeAtMaxAlloc : number = 0;

    for (var k in timeLine) { /* NOTE: relies on time sorted order */
        sumAlloc += timeLine[k].alloc;
        sumStale += timeLine[k].stale;
        if (sumAlloc > maxAlloc) {
            maxAlloc = sumAlloc;
            timeAtMaxAlloc = parseInt(k);
            staleAtMaxAlloc = sumStale;
        }
        cumTimeLine[k] = new types.Pair(sumAlloc, sumStale);
    }
    return { "maxAlloc" : maxAlloc,              /* TODO: can be inferred from other data */
             "staleAtMaxAlloc" : staleAtMaxAlloc,/* TODO: can be inferred from other data */
             "timeAtMaxAlloc" : timeAtMaxAlloc,
             "timeLine" : cumTimeLine };
}

function printCumulativeTimeLine(timeLineRec : any) : void {
    console.log("time, alloc, stale");
    for (var k in timeLineRec["timeLine"]) {
        console.log(k + ", " + timeLineRec["timeLine"][k].alloc + ", " + timeLineRec["timeLine"][k].stale);
    }
    console.log("MaxAlloc: " + timeLineRec["maxAlloc"]);
    console.log("StalenessAtMax: " + timeLineRec["staleAtMaxAlloc"]);
    console.log("TimeAtMaxAlloc: " + timeLineRec["timeAtMaxAlloc"]);
}

export function computeSampledTimeLine(objectSet: any, functionTrace : any, minTime : number, maxTime : number) : any {
    var cumulative = computeCumulativeTimeLine(objectSet);
    //printCumulativeTimeLine(cumulative);
    var funcCumTimeLine = computeCumulativeFuncTimeLine(functionTrace);
    var timeLine = cumulative["timeLine"];
    var sampledTimeLine : any = [];
    var timeStep = Math.floor((maxTime - minTime) / Thresholds.NumBars);
    //var timeStep = Math.floor(timeLine.length / Thresholds.NumBars);
    var i = 0;
    while (i < Thresholds.NumBars) {
        sampledTimeLine[i] = {};
        var upLim = timeStep * (i + 1) - 1;
        var loLim = timeStep * i;
        var j = upLim;
        var found = false;

        while ((j >= loLim)) {
            if (timeLine[j] !== undefined  &&  ! found) {
                sampledTimeLine[i].time = j;
                sampledTimeLine[i].sd = findSD(funcCumTimeLine,j);
                sampledTimeLine[i].alloc = timeLine[j].alloc;
                sampledTimeLine[i].stale = timeLine[j].stale;
                sampledTimeLine[i].lastalloc = sampledTimeLine[i].alloc;
                sampledTimeLine[i].laststale = sampledTimeLine[i].stale;
                found = true;
            } else if (timeLine[j] != undefined && found) { /* use the higher bar */
                if (sampledTimeLine[i].alloc < timeLine[j].alloc) {
                    sampledTimeLine[i].time = j;
                    sampledTimeLine[i].sd = findSD(funcCumTimeLine,j);
                    sampledTimeLine[i].alloc = timeLine[j].alloc;
                    sampledTimeLine[i].stale = timeLine[j].stale;
                }
            }
            j = j - 1;
        }
        if (! found) {
            if (i == 0) {
                sampledTimeLine[0] = {time: 0, sd:0, alloc: 0, stale: 0, lastalloc : 0, laststale : 0};
            }
            else {
                sampledTimeLine[i].time = i * timeStep;
                sampledTimeLine[i].sd = findSD(funcCumTimeLine,j);
                sampledTimeLine[i].alloc = sampledTimeLine[i - 1].lastalloc;
                sampledTimeLine[i].stale = sampledTimeLine[i - 1].laststale;
                sampledTimeLine[i].lastalloc = sampledTimeLine[i].alloc;
                sampledTimeLine[i].laststale = sampledTimeLine[i].stale;
            }
        }
        i = i + 1;
    }
    return sampledTimeLine;
}

function findSD(cumFuncTimeLine: Array<number>, time : number) {
    var loLim : number = 0;
    var j : number = time;
    var found : boolean = false;
    var sd : number = 0;

    while (j >= loLim && ! found) {
        var t = cumFuncTimeLine[j];
        if (t !== undefined) {
            sd = t;
            found = true;
        }
        j--;
    }
    if (! found) {
        console.log("Warning: no function call found on stack");
    }
    return sd;
}

//export function computeCumulativeSampledTimeLine(objectSet: any) : any {
//    var timeLine = computeTimeLine(objectSet);
//    var sampledTimeLine = [];
//    var timeStep = Math.floor(timeLine.length / Thresholds.NumBars);
//    var i = 0;
//    while (i < Thresholds.NumBars) {
//        sampledTimeLine[i] = {};
//        var upLim = timeStep * (i + 1) - 1;
//        var loLim = timeStep * i;
//        var j = upLim;
//        var found = false;
//
//        sampledTimeLine[i].time = 0;
//        sampledTimeLine[i].alloc = 0;
//        sampledTimeLine[i].stale = 0;
//        while (j >= loLim) {
//            if (timeLine[j] != undefined) {
//                sampledTimeLine[i].time = j;
//                sampledTimeLine[i].alloc += timeLine[j].alloc;
//                sampledTimeLine[i].stale += timeLine[j].stale;
//            }
//            j = j - 1;
//        }
//        i = i + 1;
//    }
//    // now cumulative
//    i = 1;
//    while (i < Thresholds.NumBars) {
//        sampledTimeLine[i].alloc += sampledTimeLine[i-1].alloc;
//        sampledTimeLine[i].stale += sampledTimeLine[i-1].stale;
//        i++;
//    }
//    return sampledTimeLine;
//}

/* ---- SITE SUMMARY ----- */
/*
   Map from site to a summary record such as containing count, maxStale, etc.
 */

export interface SSDResult {
    summaryData: { [x: string]: types.SiteSummaryData; }
    totalHeapMoment: number
    totalAllocations: number
    totalStaleness: number
}
export function computeSiteSummaryData(objectSet: any): SSDResult {
    var ssd : { [objId: string]: types.SiteSummaryData } = {};
    var totalHeapMoment = 0;
    var totalStaleness = 0;
    var totalAllocations = 0;
    for (var e in objectSet) {
        var ks = objectSet[e];
        var kind: string = "";
        var count : number = 0;
        var maxStaleness : number = 0;
        var veryStale : number = 0;
        var aggStaleness = 0;
        var aggSize : number= 0;
        var aggMoment : number = 0;

        var tnsAccum : Array<tree.TreeNode> = [];

        for (var k in ks) {
            var curKind : string = ks[k].kind;
            if (curKind !== 'PROTOTYPE') {
                // for now, skip function prototype objects
                // TODO we still want to report leaks of these objects
                kind = curKind;
            }
            var cT : number = ks[k].creationTime;
            var uT : number = ks[k].unreachableTime;
            var s : number = ks[k].staleness;
            var sz : number = ks[k].shallowSize;
            sz = 1; // Assume unit size for now
            var moment : number = sz * (uT - cT);
            count = count + 1;
            if (s > Thresholds.VeryStale) {
                veryStale = veryStale + 1;
            }
            if (s > maxStaleness) {
                maxStaleness = s;
            }
            aggSize = aggSize + sz;
            aggMoment = aggMoment + moment;
            aggStaleness += s;

            var tns : Array<tree.TreeNode> = tree.list2TreeNodes(ks[k].creationCallStack, 0);

            tree.foldInto(tns, 0, tnsAccum);

        }

        totalHeapMoment += aggMoment;
        totalAllocations += count;
        totalStaleness += aggStaleness;
        var tnsfin : tree.TreeNode = new tree.TreeNode(e, "", count, tnsAccum);

        /*
        console.log("TNSFIN = " + e + " " + count + " " + tnsfin.children.length);
        var i : number = 0;
        while (i < tnsAccum.length) {
            console.log("  " + tnsAccum[i].root + " " + tnsAccum[i].count + " " + tnsAccum[i].children.length);
            var j : number = 0;
            while (j < tnsAccum[i].children.length) {
                console.log("   " + tnsAccum[i].children[j].root + " " + tnsAccum[i].children[j].count + " " + tnsAccum[i].children[j].children.length);
                j++;
            }
            i++;
        }
        */

        ssd[e] = new types.SiteSummaryData(e, kind, count, veryStale, maxStaleness, aggSize, aggMoment, aggStaleness, tnsfin);
    }
    return { summaryData: ssd, totalHeapMoment: totalHeapMoment, totalAllocations: totalAllocations, totalStaleness: totalStaleness };
}

export function printSiteSummaryData(ssd: any) : void {
    console.log("Site, Count, MaxStaleness, VeryStale, Size, Moment");
    for (var e in ssd) {
        console.log(e +
                    ", " + ssd[e].count +
                    ", " + ssd[e].maxStaleness +
                    ", " + ssd[e].veryStale +
                    ", " + ssd[e].aggregateSize +
                    ", " + ssd[e].aggregateMoment);
    }
}

function filterSites(filter : any, ssd : any) : any {
    var ret : any = {};
    for (var e in ssd) {
        if (filter(ssd[e])) {
            ret[e] = ssd[e];
        }
    }
    return ret;
}

function hasManyStales(d : types.SiteSummaryData) : boolean {
    return (d.count > 1 && d.veryStale > 0) ; /* || ((d.count >= 100) && (d.maxStaleness >= 100)); */
}
//
//export function computeInterestingSitesData(objectSet: any) : any {
//    for (var e in objectSet) {
//        var ks = objectSet[e];
//
//        var siteos = {};
//        siteos[e] = ks;
//
//        console.log("Site:" + e + ", count :" + ks.length);
//
//        var cumulative = computeCumulativeTimeLine(siteos);
//        var tL = cumulative["timeLine"];
//
//        // find points of minima
//
//        var previous = 0;
//        var preprevious = 0;
//        var current = 0;
//        var previous_min = 0;
//
//        for (var k in tL) {
//            // assumes that tL elements are visited in growing order
//            current = k;
//
//            if ((tL[previous] != undefined) && (tL[preprevious] != undefined)) {
//                if (((tL[previous].alloc < tL[current].alloc) && (tL[previous].alloc <= tL[preprevious].alloc)) ||
//                    ((tL[previous].alloc <= tL[current].alloc) && (tL[previous].alloc < tL[preprevious].alloc))) {
//                    console.log("Local min at time: " + previous + ", alloc = " + tL[previous].alloc);
//                    console.log("   before time = " + preprevious + " alloc = " + tL[preprevious].alloc);
//                    console.log("   after  time = " + current + " alloc = " + tL[current].alloc);
//                    if (previous_min == 0) {
//                        previous_min = previous;
//                    } else if ((tL[previous].alloc > tL[previous_min].alloc)) {
//                        previous_min = previous;
//                    }
//                }
//            }
//            preprevious = previous;
//            previous = current;
//        }
//    }
//}

export function createSiteSummaryTableForGUI(objectSet: any) : any {
    var busySites : any = [];
    var ssd = computeSiteSummaryData(objectSet).summaryData;
    var toSort : any = [];
    for (var s in ssd) {
        toSort.push(ssd[s]);
    }
    // sort in a particular way
    toSort.sort(function (current : any, next : any) {
        return current.count <= next.count ? 1 : -1;
    })
    var i = 0;
    while (i < toSort.length) {
        busySites.push(toSort[i]);
        i++;
    }
    return busySites;
}

export function splitByCaller(objectSet : any) : any {
    var newObjectSet : any = {};
    for (var e in objectSet) {
        //console.log("In splitByCaller, site " + e);
        var ks = objectSet[e];
        for (var k in ks) {
            var cs = ks[k].creationCallStack;
            if (cs[1] != undefined) {
                var s = e + "##" + cs[1];
                if (newObjectSet[s] == undefined) {
                    newObjectSet[s] = [];
                }
                newObjectSet[s].push(ks[k]);
            }
        }
    }
    return newObjectSet;
}

export function analyzePaths(paths : any) : any {
    // data format: map from object id to
    // { accessPaths: Array of { path: Array of { object: string, property: string }, target: string }}

    // We will convert each access path to a TreeNode.

    var tnsAccum : Array<tree.TreeNode> = [];
    var target : string;

    for (var i in paths) { // iterate over object id's
        var or = paths[i];
        for (var j in or.accessPaths) {
            var tns  =  tree.accessPath2TreeNodes(or.accessPaths[j].path.reverse(), 0);
            target = or.accessPaths[j].target; // TODO is this always the same value or not?
            tree.foldInto(tns, 0, tnsAccum)
        }
    }

    // tack on the real target as the root
    var r : tree.TreeNode = new tree.TreeNode(target, "", 1, tnsAccum);

    return r;
}