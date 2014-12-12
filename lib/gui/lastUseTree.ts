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
/*				     
 * Copyright 2013 Samsung Information Systems America, Inc.
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

import SizeInformation = require("./SizeInformation")


export function computeTree(sizeAndStale: {[site : string]: Array<SizeInformation>}, site : string, time: number) {
    //Filter out relevant objects
    var objs = sizeAndStale[site].filter( (info : SizeInformation) => {
        return info.creationTime < time && info.unreachableTime > time
    } )
    //Bin according to last use site
    var lastUse : any = {}
    objs.forEach ( (elem : SizeInformation) => {
        var key : any = elem.lastUseSite === "null" ? "(never used)" : elem.lastUseSite
        var arr : any = lastUse[key]
        if (arr === undefined) {
            arr = []
            lastUse[key] = arr
        }
        arr.push(elem)
    })

    var res : any = {}
    // Sub-bin according to unreach site
    Object.keys(lastUse).forEach( (site) => {
        var os = lastUse[site]
        var unreachBin : {[unreach : string ] : Array<SizeInformation>} = {}
        os.forEach( (info : SizeInformation) => {
            var arr = unreachBin[info.unreachableSite]
            if (arr === undefined) {
                arr = []
                unreachBin[info.unreachableSite] = arr
            }
            arr.push(info)
        })
        res[site] = computeStats(unreachBin)
    })
    return res
}

function computeStats(obs: {[unreach : string ] : Array<SizeInformation>}) {
    var res : any = {}
    Object.keys(obs).forEach ( (un : string,a : any,b : any)  => {
        res[un] = {max: max(obs[un]).staleness, min: min(obs[un]).staleness,
                   avg: avg(obs[un]), count: obs[un].length}
    })
    return res
}

function max(arr :  Array<SizeInformation>) : SizeInformation{
    var res : SizeInformation = arr[0]
    arr.forEach( (i : SizeInformation) => {
        if (i.staleness > res.staleness)
            res = i
    })
    return res
}

function min(arr :  Array<SizeInformation>) {
    var res : SizeInformation = arr[0]
    arr.forEach( (i : SizeInformation) => {
        if (i.staleness < res.staleness)
            res = i
    })
    return res
}

function avg(arr :  Array<SizeInformation>) {
    var res = 0
    arr.forEach( (i : SizeInformation) => {
        res += i.staleness
    })
    return res / arr.length
}
