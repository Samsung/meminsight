/*
 * Copyright (c) 2015 Samsung Electronics Co., Ltd.
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

/// <reference path="../ts-declarations/node.d.ts" />

// initializes J$.memAnalysisUtils
require('./memAnalysisUtils');

declare var J$: any;


function getFreeVars(ast: any): any {
    var freeVarsTable = {};
    var na = J$.memAnalysisUtils;
    var curVarNames:any = null;
    var freeVarsHandler = (node: any, context: any) => {
        var fv:any = na.freeVars(node);
        curVarNames = fv === na.ANY ? "ANY" : Object.keys(fv);
    };
    var visitorPost = {
        'CallExpression': (node: any) => {
            if (node.callee.object && node.callee.object.name === 'J$' && (node.callee.property.name === 'Fe')) {
                var iid: any = node.arguments[0].value;
                freeVarsTable[iid] = curVarNames;
            }
            return node;
        }
    };
    var visitorPre = {
        'FunctionExpression': freeVarsHandler,
        'FunctionDeclaration': freeVarsHandler
    };
    J$.astUtil.transformAst(ast, visitorPost, visitorPre);
    return freeVarsTable;
}

export = getFreeVars;
