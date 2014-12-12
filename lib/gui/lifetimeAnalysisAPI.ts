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
///<reference path='../ts-declarations/Q.d.ts' />

// invokes the Java implementation of access paths

import fs = require('fs');
import path = require('path');
import cp = require('child_process');
import Q = require('q');
var temp = require('temp');
temp.track();

function getInputLines(objIds: Array<number>, timeStamp: number): string {
    var result = "";
    objIds.forEach(function (objId: number) {
        result += objId + "," + timeStamp + "\n";
    });
    return result;
}

export function runLifetimeAnalysis(outputDir: string) : cp.ChildProcess {
    var args = "--no-progress --staleness --enhanced --directory".split(" ");
    args.push(outputDir);
    process.env["LIFETIME_ANALYSIS_OPTS"] = "-ea -Xmx2G -Dtesting=no -Dverbosecallstack=yes";
    var res = cp.spawn("./lifetime-analysis/build/install/lifetime-analysis/bin/lifetime-analysis", args, {
        cwd   : process.cwd(),
        env   : process.env,
        stdio : ['pipe', 'pipe', 'pipe']
    });
    return res;
}


export function getAccessPaths(objIds: Array<number>, timeStamp: number, traceFile: string): Q.Promise<any> {
    var input = getInputLines(objIds, timeStamp);
    console.log("running AP analysis");
    var cliArgs = [
        "--no-progress",
        "--access-paths",
        "--trace",
        traceFile
    ];
    process.env["LIFETIME_ANALYSIS_OPTS"] = "-ea -Xmx2G -Dtesting=no";
    var proc = cp.spawn("./lifetime-analysis/build/install/lifetime-analysis/bin/lifetime-analysis", cliArgs, {
        cwd   : process.cwd(),
        env   : process.env,
        stdio : ['pipe', 'pipe', 'pipe']
    });
    var output: string = "";
    proc.stdin.write(input);
    proc.stdin.end();
    var deferred = Q.defer();
    proc.stdout.on("data", (chunk : any) => {
        output += chunk.toString();
    });

    //res.stderr.on("data", (chunk : any) => {
    // console.log("-->");
    // console.log(chunk.toString())
    // });

    proc.on('exit', () => {
        console.log("done AP analysis");
        deferred.resolve(JSON.parse(output));
    });
    return deferred.promise;
}
