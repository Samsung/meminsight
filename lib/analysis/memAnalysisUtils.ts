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


// Author: Manu Sridharan

declare var J$: any;
declare var escope: any;

// this will not generate an actual require() call,
// since jalangi is only used in a type position
import jalangi = require('jalangi2');

(function (sandbox: any) {
    var myEscope: any;
    if (typeof escope === 'undefined') {
        myEscope = require('escope');
    } else {
        myEscope = escope;
    }

    /**
     * sentinel object to represent any name
     */
    var ANY = "ANY";

    /**
     * given an AST node for a function, compute the free variables referenced from
     * the function and from nested functions.  Returns either an array of free variable
     * names (strings), or ANY, indicating that the analysis cannot compute a sound set
     * of referenced names due to some dynamic construct like eval
     */
    function freeVars(function_ast : any) : any{
        // 1. collect declarations for scope
        //    - parameters and function name (if named)
        //    - var declarations (including inside loop heads)
        //    - function statements
        // 2. collect free vars for scope, based on declarations
        // 3. recurse into nested functions, with current scope becoming "parent"
        // gotchas:
        //   - 'this' is always in scope; also 'arguments'.  watch out for other reserved words
        var result:any = {};
        if (function_ast.type !== 'Program') {
            function_ast = {
                'type': 'Program',
                'body': [function_ast]
            };
        }
        var scopes = myEscope.analyze(function_ast).scopes;
        var referenceHandler = function (r: any) {
            if (!r.resolved) {
                result[r.identifier.name] = true;
            }
        };
        for (var i = 0; i < scopes.length; i++) {
            var s = scopes[i];
            if (s.dynamic && s.type !== 'global') {
                // some use of dynamic construct, be conservative
                return ANY;
            }
            s.references.forEach(referenceHandler);
        }
        return result
    }

    /**
     * instrumentation handler that does customized instrumentation for the trace generation
     */
    var instHandler: jalangi.CustomInstHandler = {
        instrRead: (name: string, ast: any) => {
            return false;
        },
        instrWrite: (name: string, ast: any) => {
            return true;
        },
        instrGetfield: (offset: string, ast: any) => {
            return true;
        },
        instrPutfield: (offset: string, ast: any) => {
            return true;
        },
        instrBinary: (operator: string, ast: any) => {
            return operator === 'delete';
        },
        instrPropBinaryAssignment: (operator: string, offset: string, ast: any) => {
            return true;
        },
        instrUnary: (operator: string, ast: any) => {
            return false;
        },
        instrLiteral: (literal: any, ast: any) => {
            return literal !== null && literal !== undefined &&
                (typeof literal === 'object' || typeof literal === 'function');
        },
        instrConditional: (type: string, ast: any) => {
            return false;
        }

    };


    var exportObj: any = {};
    sandbox.memAnalysisUtils = exportObj;
    exportObj.ANY = ANY;
    exportObj.freeVars = freeVars;
    exportObj.instHandler = instHandler;
})((typeof J$ === 'undefined') ? J$ = {} : J$);
