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

import fs = require('fs');
import cp = require('child_process');
import path = require('path');
import Q = require('q');

export interface Issue {
    site: string
    message: string
};

export enum IssueType {
    LEAK,
    OBJINLINE,
    STACKALLOC
}

interface SiteInfo {
    siteName: string
    total: number
    countEscaping: number
    isOneAliveAtATime: boolean
    isOneUsedAtATime: boolean
    isNonEscaping: boolean
    isFrame: boolean
    isUnused: boolean
    gradient: number
    isLeaking: boolean
    isLeakingDefinitely: boolean
    notUsedAfterEscape?: boolean
    consistentlyPointedBy?: string
    maxAliveCount: number
}


function getOutputAsArray(output: any) {
    var outputArr:Array<SiteInfo> = [], i = 0;
    // current output objectInfo maps sites to info.  change it to an array
    var objInfo = output.objectInfo;
    Object.keys(objInfo).forEach((siteName) => {
        outputArr[i] = objInfo[siteName];
        outputArr[i].siteName = siteName;
        i++;
    });
    return outputArr;
}

var NUM_ISSUES_TO_SHOW = 10;

function extractIssues(allInfo: Array<SiteInfo>,
                       filterFun: (s: SiteInfo) => boolean,
                       sortFun: (s1: SiteInfo, s2: SiteInfo) => number,
                       issueGen: (info: SiteInfo) => Issue): Array<Issue> {
    var filteredAndSorted = allInfo.filter(filterFun).sort(sortFun);
    var result: Array<Issue> = [];
    for (var i = 0; i < NUM_ISSUES_TO_SHOW  && i < filteredAndSorted.length; i++) {
        var site = filteredAndSorted[i];
        result.push(issueGen(site));
    }
    return result;

}



export function computeIssues(enhTraceOutput: any): { [issueType: number]: Array<Issue> } {
    var outputArr = getOutputAsArray(enhTraceOutput);
    var result:{ [issueType:number]: Array<Issue> } = {};
    result[IssueType.LEAK] = extractIssues(outputArr,
        (s) => {
            return s.isLeakingDefinitely;
        },
        (s1, s2) => {
            return s2.maxAliveCount - s1.maxAliveCount;
        },
        (s) => {
            return { site: s.siteName, message: ""};
        });

    result[IssueType.OBJINLINE] = extractIssues(outputArr,
        (s) => {
            return s.consistentlyPointedBy !== undefined;
        },
        (s1, s2) => {
            return s2.total - s1.total;
        },
        (s) => {
            return {
                site: s.siteName,
                message: s.consistentlyPointedBy
            };
        });

    result[IssueType.STACKALLOC] = extractIssues(outputArr,
        (s) => {
            return s.isNonEscaping;
        },
        (s1, s2) => {
            return s2.total - s1.total;
        },
        (s) => {
            return {
                site: s.siteName,
                message: ""
            };
        });

    return result;
}
