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
 * Created by m.sridharan on 1/29/14.
 */

/**
 * information computed for each object by SizeAndStalenessEngine
 */
class SizeInformation {

    /**
     *
     * @param creationTime time of creation / allocation
     * @param unreachableTime time at which object become unreachable
     * @param freeableSize total size of memory dominated by object when it becomes unreachable
     * @param staleness time between last use and becoming unreachable
     * @param leastChildStaleness the minimum staleness of those objects dominated by this object when it
     * becomes unreachable
     */
    constructor(public creationTime: number,
                public unreachableTime: number,
                public shallowSize: number,
                public freeableSize: number,
                public staleness: number,
                public leastChildStaleness: number,
                public type: string,
                public lastUseTime : number,
                public lastUseSite: string,
                public unreachableSite: string) {

    }

    public toString(): string {
        return JSON.stringify(this);
    }
}

export = SizeInformation