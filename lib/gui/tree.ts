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
 * Created by schandra on 10/3/14.
 */

export class TreeNode {
    constructor (
        public root : string,
        public label : string,
        public count : number,
        public children : Array<TreeNode>
    ) {}
}

/* the top level call should set from=0 */

export function accessPath2TreeNodes(l : Array<{object: string; property:string}>, from : number) : Array<TreeNode> {
    if (l.length == from)
        return [];
    else if (parseInt(l[from].property)) {
        return [ new TreeNode(l[from].object, "A_INDEX", 1, accessPath2TreeNodes(l, from+1))]
    }
    else
        return [ new TreeNode(l[from].object, l[from].property, 1, accessPath2TreeNodes(l, from+1))]
}

export function list2TreeNodes(l : Array<string>, from : number) : Array<TreeNode> {
    if (l.length == from)
        return [];
    else if (l[from] == "unknown")
        return list2TreeNodes(l, from + 1);
    else return [ new TreeNode(l[from],"", 1, list2TreeNodes(l, from + 1)) ];
}

/* WARNING: modify receiver in place. top level call should set index=0 */
export function foldInto( giver : Array<TreeNode>, index: number, receiver : Array<TreeNode> ) {
    if (giver.length == index) {
        /* sort the receiver based on count */
        receiver.sort(
            function (current : any, next : any) {
                return current.count <= next.count ? 1 : -1;
            }
        )
    }
    else {
        foldOneInto(giver[index], receiver, 0); // modify receiver in place
        foldInto(giver, index + 1, receiver); // again, modify receiver in place
    }
}

/* modifies receiver in place */
function foldOneInto(tn : TreeNode, receiver : Array<TreeNode>, index : number ) {
    if (index == receiver.length) {
        receiver.push(tn);
    } else if (tn.root == receiver[index].root) {
        foldInto(tn.children, 0, receiver[index].children);
        var t : TreeNode = new TreeNode(tn.root,
                                        mergeLabel(tn, receiver[index]),
                                        mergeCount(tn, receiver[index]), receiver[index].children);
        receiver[index] = t;
    } else
        foldOneInto(tn, receiver, index+1);
}

function mergeCount(a : TreeNode, b : TreeNode) : number {
    return a.count + b.count;
}

function mergeLabel(a : TreeNode, b : TreeNode) : string {

    var alabels : Array<string> = a.label.split("|");
    var blabels : Array<string> = b.label.split("|");

    for (var i in blabels) {
        var e = blabels[i];
        if (alabels.indexOf(e) != -1) {
            // already occurs
        } else {
            alabels.push(e);
        }
    }
    return alabels.join("|")
}