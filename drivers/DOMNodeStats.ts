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
 * Created by m.sridharan on 8/3/14.
 */

var fs = require('fs');

var stalenessInfo: any = JSON.parse(String(fs.readFileSync(process.argv[2])));

var totalObjs = 0, totalDOM = 0, initialDOM = 0, knownAllocDOM = 0, unknownAllocDOM = 0, staleDOM = 0;

Object.keys(stalenessInfo.objectInfo).forEach((alloc: string) => {
    var objs: Array<any> = stalenessInfo.objectInfo[alloc];
    if (alloc === 'initial DOM') {
        totalObjs += objs.length;
        totalDOM += objs.length;
        initialDOM += objs.length;
    } else {
        objs.forEach((objInfo: any) => {
            totalObjs++;
            if (objInfo.type === 'DOM') {
                totalDOM++;
                if (alloc === 'unknown') {
                    unknownAllocDOM++;
                } else {
                    knownAllocDOM++;
                }
            }
        });
    }
    objs.forEach((objInfo: any) => {
        if (objInfo.type === 'DOM' && parseInt(objInfo.staleness) > 0) {
            staleDOM++;
        }
    });
});

console.log("Total objects: " + totalObjs);
console.log("Total DOM: " + totalDOM);
console.log("Initial DOM: " + initialDOM);
console.log("DOM with known allocation site: " + knownAllocDOM);
console.log("DOM with unknown allocation site: " + unknownAllocDOM);
console.log("Stale DOM nodes: " + staleDOM);
