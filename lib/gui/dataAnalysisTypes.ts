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
/**
 * Created by schandra on 2/18/14.
 */

import tree = require('./tree');

export class ObjectRecord {
    constructor (
        public site : string,
        public kind : string,
        public creationTime : number,
        public unreachableTime : number,
        public shallowSize : number,
/*        public freeableSize : number, */
        public staleness : number,
        public lastUseTime : number,
/*        public leastChildStaleness : number, */
        public accessPaths :Array<{path: Array<{object: string; property: string}>; target: string}>,
        public creationCallStack : any
        ) {
    }
}

export class Pair {
    constructor(
        public alloc : number,
        public stale : number) {
    }
};

export class FunRec {
    constructor(
        public IID : number,
        public kind : number) {
    }
};

export class SiteSummaryData {
    constructor (
        public site : string,
        public kind : string,
        public count : number,
        public veryStale : number,
        public maxStaleness : number,
        public aggregateSize : number,
        public aggregateMoment : number,
        public aggregateStaleness: number,
        public allocTree : tree.TreeNode) {
    }
}
