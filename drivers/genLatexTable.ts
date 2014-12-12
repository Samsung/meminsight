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
 * Created by m.sridharan on 8/1/14.
 */


import fs = require('fs');
import path = require('path');


function genHeader(): string {
    var result = "\\begin{table*}\n\\centering\n\\begin{footnotesize}\n" +
        "\\begin{tabular}{c|r||r|r||r|r||r|r}\n";
    result += "bench & LOC & baseTime (s) & baseMem (MB) & logTime & logMem & traceSize & enhTime (s) \\\\\\hline\n";
    return result;
}

function genFooter(): string {
    return "\\end{tabular}\n\\end{footnotesize}\n" +
    "\\caption{Overheads for running on Octane benchmarks and node.js case studies.}\n" +
    "\\label{tbl:overhead}\n" +
    "\\end{table*}\n";
}

function genContent(filename: string): string {
    var result = "";
    var inputLines = String(fs.readFileSync(filename)).split('\n');
    var i = 0;
    var addToRow = (num: string) => {
        result += num + " & ";
    };
    var memRegExp = /(.*)MB--(.*)MB/;
    var getAvgMem = (memRange: string): number => {
        var match = memRegExp.exec(memRange);
        var low = parseFloat(match[1]);
        var high = parseFloat(match[2]);
        return (high + low) / 2;
    };
    var getNextLineCol = (col: number): string => {
        return inputLines[i++].split(' ')[col];
    };
    var formatRunningTime = (msTime: string, precision?: number): string => {
        if (!precision) {
            precision = 1;
        }
        return String((parseFloat(msTime) / 1000).toFixed(precision));
    }
    while (i < inputLines.length - 1) {
        var benchmark = inputLines[i++];
        addToRow(benchmark);
        var benchLOC = getNextLineCol(1);
        addToRow(benchLOC);
        var uninstRunningTime = getNextLineCol(4);
        addToRow(formatRunningTime(uninstRunningTime, 2));
        var uninstMemRange = getNextLineCol(3);
        var uninstAvgMem = getAvgMem(uninstMemRange);
        addToRow(String(uninstAvgMem.toFixed(1)));
        var instrumentationTime = getNextLineCol(2);
//        addToRow(formatRunningTime(instrumentationTime));
        var jalangiRunningTime = getNextLineCol(5);
        var jalangiOverhead = getNextLineCol(3);
//        addToRow(parseFloat(jalangiOverhead).toFixed(1) + "X");
        var jalangiMemRange = getNextLineCol(4);
        var jalangiAvgMem = getAvgMem(jalangiMemRange);
//        addToRow((jalangiAvgMem / uninstAvgMem).toFixed(1) + "X");
        var analysisRunTime = getNextLineCol(5);
        var analysisOverhead = getNextLineCol(3);
        addToRow(parseFloat(analysisOverhead).toFixed(1) + "X");
        var analysisMemRange = getNextLineCol(4);
        var analysisAvgMem = getAvgMem(analysisMemRange);
        addToRow((analysisAvgMem / uninstAvgMem).toFixed(1) + "X");
        // skip a line
        i++;
        var traceSize = getNextLineCol(2);
        addToRow(traceSize);
        var enhancedTraceRunTime = getNextLineCol(2);
        result += formatRunningTime(enhancedTraceRunTime);
        while (inputLines[i] !== "====================================") {
            i++;
        }
        result += " \\\\\n";
        i++;
    }
    return result;
}

var output = genHeader() + genContent(process.argv[2]) + "\\hline\n" + genContent(process.argv[3]) + genFooter();
console.log(output);
