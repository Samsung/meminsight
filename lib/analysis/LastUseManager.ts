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

///<reference path='./Loggers.ts' />

/**
 * Created by m.sridharan on 11/7/14.
 */
module ___LoggingAnalysis___ {

    export class LastUseManager {

        /**
         * maps objects to their last use time.  if we have lastUseTime[i] == t, then
         * the last use of object i logically occurred immediately *after* the event at
         * time t, where time starts at 0 and is incremented by 1 for each line in the trace
         * @type {Array}
         */
        private lastUseTime: Array<number> = [];

        /**
         * maps objects to their last use source ID (sid + ':' + iid)
         * @type {Array}
         */
        private lastUseSourceID: Array<string> = [];

        private logger: Logger;

        /**
         * ONLY FOR BENCHMARKING
         *
         * if true, write a last-use record at each call to updateLastUse(),
         * to simulate logging all uses.
         */
        private eagerFlush: boolean;

        constructor(eagerFlush = false) {
            this.eagerFlush = eagerFlush;
        }

        setLogger(logger: Logger) {
            this.logger = logger;
        }
        flushLastUse() {
            var logger = this.logger;
            this.lastUseTime.forEach((val,idx) => {
                if (val !== -1) {
                    logger.logLastUse(idx, val, this.lastUseSourceID[idx]);
                }
            });
            logger.endLastUse();
            this.lastUseTime = [];
            this.lastUseSourceID = [];
        }

        getSourceId(iid: number): string {
            return J$.sid + ':' + iid;
        }

        updateLastUse(objId: number, iid: number, time: number) {
            var sourceId = this.getSourceId(iid);
            if (this.eagerFlush) {
                this.logger.logLastUse(objId, time, sourceId);
            } else {
                this.lastUseTime[objId] = time;
                this.lastUseSourceID[objId] = sourceId;
            }
        }
    }
}