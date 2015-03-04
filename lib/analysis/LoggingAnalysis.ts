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
///<reference path='./Loggers.ts' />
///<reference path='./InstUtils.ts' />
///<reference path='./ObjIdManager.ts' />
///<reference path='./LastUseManager.ts' />
///<reference path='./NativeModels.ts' />
/**
 * Created by m.sridharan on 5/29/14.
 */


declare var J$: any;
declare var astUtil: any;

module ___LoggingAnalysis___ {

    var myAstUtil = isBrowser ? astUtil : require('jalangi/src/js/utils/astUtil');

    if (!isBrowser) {
        require('../lib/analysis/memAnalysisUtils');
    }

    class LoggingAnalysis {
        /***************************************/
        /* ANALYSIS STATE AND INTERNAL METHODS */
        /***************************************/

        private updateLastUse(objId: number,iid:number) {
            this.lastUse.updateLastUse(objId, iid, this.logger.getTime());
        }


        /**
         * indicates top-level expressions, which necessitate a flush
         */
        private topLevelExprs: { [iid:string]: boolean } = {};


        private handleTopLevel(iid: number): void {
            if (this.logger.getFlushIID() === FlushIIDSpecial.ALREADY_FLUSHED && this.topLevelExprs[iid]) {
                this.logger.setFlushIID(iid);
                // at this point, we can empty the map from native objects to iids,
                // since after a flush we won't be storing them anywhere
                this.idManager.flushNativeObj2IIDInfo();

            }
        }


        private logger: Logger;

        private idManager: ObjIdManager;

        private nativeModels: NativeModels;

        private lastUse: LastUseManager;
        /***********************************/
        /* CONSTRUCTOR AND JALANGI METHODS */
        /***********************************/

        constructor() {
        }

        private initJalangiConfig(): void {
            var conf = J$.Config;
            var instHandler = J$.memAnalysisUtils.instHandler;
            conf.INSTR_READ = instHandler.instrRead;
            conf.INSTR_WRITE = instHandler.instrWrite;
            conf.INSTR_GETFIELD = instHandler.instrGetfield;
            conf.INSTR_PUTFIELD = instHandler.instrPutfield;
            conf.INSTR_BINARY = instHandler.instrBinary;
            conf.INSTR_PROPERTY_BINARY_ASSIGNMENT = instHandler.instrPropBinaryAssignment;
            conf.INSTR_UNARY = instHandler.instrUnary;
            conf.INSTR_LITERAL = instHandler.instrLiteral;
            conf.INSTR_CONDITIONAL = instHandler.instrConditional;
        }

        init(initParam: any): void {
            var endTracingFun = () => {
                this.lastUse.flushLastUse(() => {
                    alert("trace generation complete\n" /*+ this.nativeModels.getNumDOMNodesModeled() + " DOM node locations from models"*/);
                });
                this.logger.stopTracing();
            };
            this.initLogger(initParam, endTracingFun);
            this.lastUse = new LastUseManager(this.logger, initParam["allUses"] !== undefined);
            var idManager = createObjIdManager(this.logger, this.lastUse, initParam["useHiddenProp"] !== undefined);
            this.idManager = idManager;
            this.nativeModels = new NativeModels(idManager, this.logger);
            this.logAllPutfields = initParam["allPutfields"] !== undefined;
            this.initJalangiConfig();
            var debugFun = initParam["debugFun"];
            if (debugFun) {
                // we monkey-patch here to avoid checking the debug flag on every invocation
                // of invokeFunPre
                var origInvokeFunPre = this.invokeFunPre;
                this.invokeFunPre = (iid:number, f:any, base:any, args:any, isConstructor:boolean, isMethod: boolean) => {
                    if (f && f.name === debugFun) {
                        var obj = args[0];
                        // we should already have metadata for the object
                        if (!idManager.hasMetadata(obj)) {
                            throw new Error("missing metadata for argument to debug function");
                        }
                        var objId = idManager.findExtantObjId(obj);
                        this.logger.logDebug(iid, objId);
                    }
                    origInvokeFunPre.call(this,iid,f,base,args,isConstructor,isMethod);
                }
            }
            //if (isBrowser) {
            //    window.addEventListener('keydown', (e) => {
            //        // keyboard shortcut is Alt-Shift-T for now
            //        if (e.altKey && e.shiftKey && e.keyCode === 84) {
            //            endTracingFun();
            //        }
            //    });
            //    // for Tizen apps
            //    document.addEventListener('tizenhwkey', (e) => {
            //        if ((<any>e).keyName === 'menu') {
            //            endTracingFun();
            //        }
            //    });
            //}
        }

        initLogger(initParam: any, endTracingFun: () => void) {
            var logger:Logger;
            if (isBrowser) {
                if (initParam["syncAjax"]) {
                    throw new Error("TODO revive support for synchronous AJAX logging");
//                    logger = new SyncAjaxLogger();
                } else {
                    var serverIP = initParam["serverIP"], serverPort = initParam["serverPort"];
                    if (!serverIP || !serverPort) {
                        throw new Error("server IP and/or port not specified!");
                    }
                    logger = new BinaryWebSocketLogger(serverIP, serverPort, endTracingFun);
                }
            } else {
                if (initParam["syncFS"]) {
                    if (initParam["asciiFS"]) {
                        logger = new AsciiFSLogger();
                    } else {
                        logger = new BinaryFSLogger();
                    }
                } else {
                    var serverIP = initParam["serverIP"], serverPort = initParam["serverPort"];
                    if (!serverIP || !serverPort) {
                        throw new Error("server IP and/or port not specified!");
                    }
                    logger = new NodeWebSocketLogger(initParam["appDir"], serverIP, serverPort);
                }
            }
            this.logger = logger;
        }

        onReady(readyCB: () => void) {
            if (this.logger instanceof NodeWebSocketLogger) {
                (<NodeWebSocketLogger>this.logger).setConnectCB(readyCB);
            } else {
                readyCB();
            }
        }

        declare(iid:number, name:string, val:any, isArgument:boolean):any {
            // TODO handle case where code overwrites arguments?
            if (name !== 'arguments') {
                var id = 0;
                if (isObject(val)) {
                    id = this.idManager.findOrCreateUniqueId(val, iid, false);
                }
                this.logger.logDeclare(iid, name, id);
            }
        }

        literal(iid:number, val:any, hasGetterSetter: boolean):any {
            if (isObject(val)) {
                var valId = this.idManager.findOrCreateUniqueId(val, iid, true);
                if (!(typeof val === 'function')) {
                    this.handleLiteralProperties(iid, val, valId, hasGetterSetter);
                }
            }
            this.handleTopLevel(iid);
        }

        private handleLiteralProperties(iid: number, lit: any, litId: number, hasGetterSetter: boolean) {
            var props = Object.keys(lit);
            var simple = (offset: string) => {
                var child = lit[offset];
                if (isObject(child)) {
                    var childId = this.idManager.findOrCreateUniqueId(child, iid, false);
                    this.logger.logPutfield(iid,litId,offset,childId);
                }
            };
            if (!hasGetterSetter) {
                props.forEach(simple);
            } else {
                props.forEach((offset) => {
                    var descriptor = Object.getOwnPropertyDescriptor(lit,offset);
                    if (descriptor.get !== undefined || descriptor.set !== undefined) {
                        var annotateGetterSetter = (fun:any, getter: boolean) => {
                            if (fun) {
                                // fun may already be annotated in the case where we
                                // are annotating properties of an object returned from a constructor
                                // call. but, we can't detect this case.
                                var id = this.idManager.findOrCreateUniqueId(fun, iid, true);
                                var synthProp = getter ? "~get~" + fun.name : "~set~" + fun.name;
                                this.logger.logPutfield(iid, litId, synthProp, id);
                            }
                        };
                        annotateGetterSetter(descriptor.get, true);
                        annotateGetterSetter(descriptor.set, false);
                    } else {
                        simple(offset);
                    }
                });
            }
        }

        private emittedCall = false;

        invokeFunPre(iid:number, f:any, base:any, args:any, isConstructor:boolean, isMethod: boolean): void {
            if (!this.nativeModels.modelInvokeFunPre(iid, f, base, args, isConstructor, isMethod)) {
                if (f) {
                    var funEnterIID = lookupCachedFunEnterIID(f);
                    if (funEnterIID !== undefined) {
                        var funObjId = this.idManager.findObjId(f);
                        this.logger.logCall(iid, funObjId, funEnterIID);
                        this.emittedCall = true;
                    }
                }
            }
        }


        /**
         * if evalIID === -1, indirect eval
         * @param evalIID
         * @param iidMetadata
         */
        instrumentCode(evalIID: number, newAST: any): void {
            var newTopLevel: Array<number> = myAstUtil.computeTopLevelExpressions(newAST);
            newTopLevel.forEach((iid: number) => {
                this.topLevelExprs[iid] = true;
            });
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
                        this.logger.logFreeVars(iid, curVarNames);
                    }
                    return node;
                }
            };
            var visitorPre = {
                'FunctionExpression': freeVarsHandler,
                'FunctionDeclaration': freeVarsHandler
            };
            myAstUtil.transformAst(newAST, visitorPost, visitorPre);

        }

        invokeFun(iid:number, f:any, base:any, args:any, val:any, isConstructor:boolean, isMethod: boolean):any {
            var idManager = this.idManager;
            if (isObject(val)) {
                if (idManager.hasMetadata(val)) {
                    var metadata: number = idManager.getMetadata(val);
                    if (idManager.isUnannotatedThis(metadata)) {
                        var objId = idManager.extractObjId(metadata);
                        if (isConstructor) {
                            // update the IID
                            this.logger.logUpdateIID(objId, iid);
                            // log a putfield to expose pointer to the prototype object
                            var funProto = f.prototype;
                            if (isObject(funProto)) {
                                var funProtoId = idManager.findOrCreateUniqueId(funProto, iid, false);
                                this.logger.logPutfield(iid, objId, "__proto__", funProtoId);
                            }

                        }
                        // unset the bit
                        idManager.setMetadata(val,objId);
                    }
                } else {
                    // native object.  stash away the iid of the call
                    // in case we decide to create an id for the object later
                    idManager.setIIDForNativeObj(val,iid);
                }
            }
            this.nativeModels.modelInvokeFun(iid, f, base, args, val, isConstructor, isMethod);
            var funId = idManager.findObjId(f);
            if (funId !== -1) {
                this.updateLastUse(funId,iid);
            }
            this.handleTopLevel(iid);
        }

        /**
         * whether logging can be skipped for a putfield.
         * We need a stack to handle case where putfield
         * invokes a setter that itself contains a putfield
         * @type {Array}
         */
        private skipLoggingStack: Array<boolean> = [];

        /**
         * if true, log all putfields, even if value before
         * and after is a primitive
         * @type {boolean}
         */
        private logAllPutfields: boolean = false;

        putFieldPre(iid:number, base:any, offset:any, val:any):any {
            var skipLogging = false;
            if (isObject(base) && !this.logAllPutfields) {
                // can only skip if new value is a primitive
                if (!isObject(val)) {
                    // property must be a non-getter-setter defined on the object itself
                    var desc = Object.getOwnPropertyDescriptor(base,offset);
                    if (desc && !desc.set && !desc.get) {
                        // old value must be a primitive
                        var oldVal: any = base[offset];
                        if (!isObject(oldVal)) {
                            // we can skip logging!
                            skipLogging = true;
                        }
                    }
                } else {
                    var nativeResult = this.nativeModels.modelPutFieldPre(iid, base, offset, val);
                    if (nativeResult) {
                        return nativeResult;
                    }
                }
            }
            this.skipLoggingStack.push(skipLogging);
        }

        putField(iid:number, base:any, offset:any, val:any):any {
            var skipLogging = this.skipLoggingStack.pop();
            if (isObject(base)) {
                var baseId = this.idManager.findObjId(base);
                if (baseId !== -1) {
                    if (!skipLogging) {
                        if (!isGetterSetter(base,offset)) {
                            var valId = isObject(val) ? this.idManager.findOrCreateUniqueId(val,iid,false) : 0;
                            this.logger.logPutfield(iid,baseId,String(offset),valId);
                        }
                    }
                    this.updateLastUse(baseId,iid);
                }
                this.nativeModels.modelPutField(iid, base, offset, val);
            }
            this.handleTopLevel(iid);
        }

        private logWrite(iid:number,name:string,valId:number) {
            if (!name) {
                throw new Error("got an invalid name for iid " + iid);
            }
            this.logger.logWrite(iid, name, valId);
        }

        write(iid:number, name:any, val:any, oldValue:any):any {
            if (isObject(val)) {
                var id = this.idManager.findOrCreateUniqueId(val,iid, false);
                this.logWrite(iid,name,id);
            } else if (isObject(oldValue)) {
                // need the write so oldValue's ref-count gets updated
                this.logWrite(iid,name,0);
            } else {
                // old and new values are primitives, so we don't need to log anything
            }
            this.handleTopLevel(iid);
        }

        /**
         * for each call frame, either the metadata for the unannotated this parameter,
         * or 0 if this was annotated
         * @type {Array}
         */
        private unannotThisMetadata: Array<number> = [];

        functionEnter(iid:number, fun:any, dis:any /* this */, args:any):void {
            if (this.emittedCall) {
                // we emitted a call entry, so we don't need a functionEnter also
                this.emittedCall = false;
            } else {
                var funId = this.idManager.findOrCreateUniqueId(fun,iid, false);
                this.logger.logFunctionEnter(iid, funId);
                // in this case, we won't see the invokeFun callback at the
                // caller to update the last use of fun.  so, update it here
                this.updateLastUse(funId, iid);
            }
            var metadata = 0;
            // check for unannotated this and flag as such
            if (dis !== GLOBAL_OBJ) {
                var idManager = this.idManager;
                if (!idManager.hasMetadata(dis)) {
                    // TODO could optimize to only add value to obj2Metadata once
                    var id = idManager.findOrCreateUniqueId(dis,iid,false);
                    metadata = idManager.setUnannotatedThis(id);
                    idManager.setMetadata(dis,metadata);
                    this.unannotThisMetadata.push(metadata);
                } else {
                    metadata = idManager.getMetadata(dis);
                    this.unannotThisMetadata.push(0);
                }
            } else {
                this.unannotThisMetadata.push(0);
            }
            if (metadata !== 0) { // if dis is not the global object
                // declare the value of 'this' in the trace
                this.logger.logDeclare(iid, "this", this.idManager.extractObjId(metadata));
            }

            // functionEnter cannot be top-level
//            this.handleTopLevel(iid);
        }
        getField(iid:number, base:any, offset:any, val:any):any {
            // base may not be an object, e.g., if it's a string
            if (isObject(base)) {
                // TODO fix handling of prototype chain
                var id = this.idManager.findObjId(base);
                if (id !== -1) {
                    this.updateLastUse(id,iid);
                }
            }
            this.handleTopLevel(iid);
        }

        functionExit(iid:number, returnVal: any, exceptionVal: any):void {
            var loggedReturn = false;
            if (isObject(returnVal)) {
                var idManager = this.idManager;
                if (idManager.hasMetadata(returnVal)) {
                    this.logger.logReturn(idManager.findExtantObjId(returnVal));
                    loggedReturn = true;
                }
            }
            // NOTE: analysis should treat function exit as a top-level flush as well
            var unannotatedThis = this.unannotThisMetadata.pop();
            if (unannotatedThis !== 0 && !loggedReturn) {
                // we had an unannotated this and no explicit return.
                // we are very likely exiting from a constructor call.
                // so, add a RETURN log entry for this, so that it doesn't
                // become unreachable.
                // this could be the wrong thing to do, e.g., if this function
                // is actually being invoked from uninstrumented code.
                // don't worry about that corner case for now.
                this.logger.logReturn(this.idManager.extractObjId(unannotatedThis));
            }
            this.logger.logFunctionExit(iid);
        }

        read(iid:number, name:any, val:any, isGlobal:boolean):any {
            this.handleTopLevel(iid);
        }

        binary(iid:number, op:string, left:any, right:any, result_c:any):any {
            if (op === 'delete') {
                // left is object, right is property
                var base = left;
                var offset = right;
                if (isObject(base)) {
                    var baseId = this.idManager.findObjId(base);
                    if (baseId !== -1 && offset !== null && offset !== undefined) {
                        this.logger.logPutfield(iid,baseId,String(offset),0);
                        this.updateLastUse(baseId,iid);
                    }
                }
            }
            this.handleTopLevel(iid);
        }

        unary(iid:number, op:string, left:any, result_c:any):any {
            this.handleTopLevel(iid);
        }

        conditional(iid:number, left:any, result_c:any):any {
            this.handleTopLevel(iid);
        }

        scriptEnter(iid:number, fileName:string):void {
            this.logger.logScriptEnter(iid, fileName);
            // get the latest top level expressions
            var topLevel = this.topLevelExprs;
            J$.topLevelExprs.forEach((iid:number) => {
                topLevel[iid] = true;
            });

        }

        scriptExit(iid:number):void {
            this.logger.logScriptExit(iid);
        }

        /**
         * public flag indicating when logging is complete
         * @type {boolean}
         */
        doneLogging:boolean = false;

        endExecution():any {
            this.lastUse.flushLastUse(() => { this.doneLogging = true; });
            return {};
        }


    }

    var loggingAnalysis = new LoggingAnalysis();
    loggingAnalysis.init(J$.initParams);
    J$.analysis = loggingAnalysis;
}


