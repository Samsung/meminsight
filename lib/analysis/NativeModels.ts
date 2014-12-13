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

///<reference path='./ObjIdManager.ts' />
///<reference path='./MapShim.ts' />
///<reference path='./MutationObserverShim.ts' />


declare var J$: any;

/**
 * Created by m.sridharan on 11/6/14.
 */
module ___LoggingAnalysis___ {

    class LoggingMutationObserver {

        private mutObserverConfig = { attributes: true, childList: true, characterData: false, subtree: false };

        private observer: MutationObserver;

        // for counting how many times we used modeled object ids
        private numDOMCreationIIDUsed = 0;

        constructor(public idManager: ObjIdManager,
                    public logger: Logger) {
            this.observer = allocMutationObserver((mutations: MutationRecord[]) => {
                var didSomething = false;
                mutations.forEach((mut: MutationRecord) => {
                    var target = mut.target;
                    var targetId = idManager.findExtantObjId(target);
                    var added = mut.addedNodes;
                    for (var i = 0; i < added.length; i++) {
                        var child = added[i];
                        var childId = this.findOrCreateIdForDOMNode(child, false);
                        this.logger.logAddDOMChild(targetId, childId);
                        if (!this.isObserved(child)) {
                            this.domWalk(child);
                        }
                    }
                    var removed = mut.removedNodes;
                    for (i = 0; i < removed.length; i++) {
                        var removedNode = removed[i];
                        var removedId = this.findOrCreateIdForDOMNode(removedNode,false);
                        this.logger.logRemoveDOMChild(targetId, removedId);

                    }
                    didSomething = didSomething || added.length > 0 || removed.length > 0;
                });
                if (didSomething) {
                    this.logger.setFlushIID(FlushIIDSpecial.UNKNOWN);
                }
            });

            document.addEventListener('DOMContentLoaded', () => {
                // create object id for document and document.documentElement
                var documentObjId = idManager.findOrCreateUniqueId(document, Constants.INIT_DOM_TRAVERSAL_IID, false);
                this.logger.logWrite(Constants.INIT_DOM_TRAVERSAL_IID,'document',documentObjId);
                var docElementObjId = idManager.findOrCreateUniqueId(document.documentElement,Constants.INIT_DOM_TRAVERSAL_IID,false);
                this.logger.logPutfield(Constants.INIT_DOM_TRAVERSAL_IID,documentObjId,"documentElement",docElementObjId);
                // mark document.documentElement as the DOM root
                this.logger.logDOMRoot(docElementObjId);
                this.domWalk(document.documentElement, true);
                this.logger.setFlushIID(FlushIIDSpecial.UNKNOWN);
            });

        }

        /**
         * log a creation record for all descendants of node
         * @param node
         * @param iid
         */
        createDOMNodeDescendants(node: Node, iid: number) {
            var children = node.childNodes;
            var idManager = this.idManager;
            var logger = this.logger;
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                idManager.findOrCreateUniqueId(child, iid, false);
                this.numDOMCreationIIDUsed++;
                // NOTE: by not logging an appropriate addDOMChild record here,
                // we will get bogus unreachability records for this node.  But,
                // weird interactions with the mutation observer, detached DOMs,
                // etc. make logging the add child here worse I think --MS
                this.createDOMNodeDescendants(child, iid);
            }
        }

        private getDOMCreationIID(node: Node, initial?: boolean): number {
            return (initial ? Constants.INIT_DOM_TRAVERSAL_IID : Constants.MUT_OBSERVER_IID);
        }


        private observe(node: any) {
            this.observer.observe(node, this.mutObserverConfig);
            node.isObserved = true;
        }

        private isObserved(node: any) {
            return node.isObserved === true
        }

        private findOrCreateIdForDOMNode(obj: any, initial?: boolean) {
            var fallbackIID = this.getDOMCreationIID(obj, initial);
            var result = this.idManager.findOrCreateUniqueId(obj, fallbackIID, false);
            return result;
        }

        private domWalk(node: Node, initial?: boolean) {
            if (this.isObserved(node)) {
                // called through mutation observer; shouldn't be called
                // on already-observed nodes
                throw new Error("shouldn't happen");
            } else {
                this.observe(node);
            }
            var nodeId = this.findOrCreateIdForDOMNode(node, initial);
            var children = node.childNodes;
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                var childId = this.findOrCreateIdForDOMNode(child, initial);
                this.logger.logAddDOMChild(nodeId, childId);
                if (!this.isObserved(child)) {
                    this.domWalk(child, initial);
                }
            }
        }

        getNumNodesModeled() {
            return this.numDOMCreationIIDUsed;
        }

    }
    /**
     * includes our models of native functions and our mutation observer
     * code for handling the DOM
     */
    export class NativeModels {

        private mutObs: LoggingMutationObserver;

        constructor(public idManager: ObjIdManager, public logger: Logger) {
            if (isBrowser) {
                this.mutObs = new LoggingMutationObserver(idManager, logger);
            }
            this.initInterestingNatives();
        }

        getNumDOMNodesModeled() {
            return this.mutObs.getNumNodesModeled();
        }

        modelPutField(iid: number, base: any, offset: any, val: any) {
            if (isBrowser && base instanceof Element && offset === 'innerHTML') {
                this.mutObs.createDOMNodeDescendants(base, iid);
            }
        }

        modelPutFieldPre(iid:number, base:any, offset:any, val:any): any {
            // native modeling: 'onreadystatechange' for XMLHttpRequest
            if (isBrowser && base instanceof XMLHttpRequest && offset === 'onreadystatechange') {
                // write a wrapped function
                var fun = val;
                if (typeof fun === 'function') {
                    var funIID = getFunEnterIID(fun);
                    var self = this;
                    var freshGlobal = "~readystatechange~global~" + (++this.callbackCounter);
                    self.logger.logWrite(iid, freshGlobal, this.idManager.findOrCreateUniqueId(fun, iid,  false));
                    var wrapper = function() {
                        try {
                            fun.apply(this,arguments);
                        } finally {
                            if (this.readyState === this.DONE) {
                                // null out the global
                                self.logger.logWrite(funIID,freshGlobal,0);
                                self.logger.setFlushIID(funIID);
                            }
                        }
                    };
                    return {base:base,offset:offset,val:wrapper,skip:false};
                }
            }
            return undefined;
        }

        /**
         * native functions that we model before they have been called, i.e., in invokeFunPre()
         */
        private invokeFunPreNatives = allocMap<Function,string>();

        /**
         * native functions that we model after they have been called, i.e., in invokeFun()
         */
        private invokeFunPostNatives = allocMap<Function,string>();

        private initInterestingNatives() {
            var preMap = this.invokeFunPreNatives;
            preMap.set(Array.prototype.splice, "Array.prototype.splice");
            preMap.set(setTimeout, "setTimeout");
            var postMap = this.invokeFunPostNatives;
            postMap.set(Array.prototype.pop, "Array.prototype.pop");
            postMap.set(Array.prototype.push, "Array.prototype.push");
            postMap.set(Array.prototype.shift, "Array.prototype.shift");
            postMap.set(Array.prototype.unshift, "Array.prototype.unshift");
            postMap.set(Array.prototype.concat, "Array.prototype.concat");
            postMap.set(Array.prototype.splice, "Array.prototype.splice");
            postMap.set(setTimeout, "setTimeout");
            postMap.set(clearTimeout, "clearTimeout");
            postMap.set(setInterval, "setInterval");
            postMap.set(clearInterval, "clearInterval");
            postMap.set(Object.defineProperty, "Object.defineProperty");
            if (isBrowser) {
                postMap.set(addEventListener, "addEventListener");
                postMap.set(removeEventListener, "removeEventListener");
                // in browsers other than Chrome, window.add(remove)EventListener
                // is a different function than document.add(remove)EventListener,
                // so put both in map
                postMap.set(document.addEventListener, "addEventListener");
                postMap.set(document.removeEventListener, "removeEventListener");
                postMap.set(HTMLElement.prototype.insertAdjacentHTML, "HTMLElement.prototype.insertAdjacentHTML");
            }
        }


        private spliceOldLen: number;

        private callbackIdToGlobal = allocMap<number,string>();

        private callbackCounter = 0;

        modelInvokeFunPre(iid:number, f:any, base:any, args:any, isConstructor:boolean, isMethod: boolean): boolean {
            if (this.invokeFunPreNatives.has(f)) {
                if (f === Array.prototype.splice) {
                    // to model splice, we need to stash away the old length of the array
                    this.spliceOldLen = base.length;
                } else if (f === setTimeout) {
                    // keep 'this' pointer ourselves since we need to refer to the real 'this'
                    // inside the function
                    var fun = args[0];
                    if (typeof fun === 'function') {
                        var funIID = getFunEnterIID(fun);
                        var self = this;
                        var freshGlobal = "~timer~global~" + (++this.callbackCounter);
                        var wrapper = function () {
                            // invoke the function, and null out the global
                            try {
                                fun.apply(this, arguments);
                            } finally {
                                self.logger.logWrite(funIID, freshGlobal, 0);
                                self.logger.setFlushIID(funIID);
                                self.callbackIdToGlobal.delete((<any>wrapper).timeoutId);
                            }
                        };
                        (<any>wrapper).globalName = freshGlobal;
                        this.logger.logWrite(iid, freshGlobal, this.idManager.findOrCreateUniqueId(fun, iid, false));
                        args[0] = wrapper;
                    }
                }
                return true;
            }
            return false;
        }

        modelInvokeFun(iid:number, f:any, base:any, args:any, val:any, isConstructor:boolean, isMethod: boolean): boolean {
            if (this.invokeFunPostNatives.has(f)) {
                this.modelNativeFunction(iid, f, base, args, val, isConstructor, this.invokeFunPostNatives.get(f));
                return true;
            }
            return false;
        }

        private modelNativeFunction(iid:number, f:any, base:any, args:any, val:any, isConstructor:boolean, name: string): void {
            var fun = this.nativeFunctionModels[name];
            if (fun) {
                fun(iid, f, base, args, val, isConstructor, name);
            }
        }

        private nativeFunctionModels:
            { [name:string]: (iid:number, f:any, base:any, args:any, val:any, isConstructor: boolean, name: string) => void } =
        {
            'Array.prototype.push': (iid,f,base,args,val,isConstructor,name) => {
                var len = base.length;
                var baseId = this.idManager.findObjId(base);
                if (typeof len === 'number' && baseId !== -1) {
                    var ind = len-1;
                    for (var argInd = args.length-1; argInd >= 0; argInd--) {
                        var argId = this.idManager.findObjId(args[argInd]);
                        if (argId !== -1) {
                            this.logger.logPutfield(iid, baseId, String(ind), argId);
                        }
                        ind--;
                    }
                }
            },
            'Array.prototype.pop': (iid,f,base,args,val,isConstructor,name) => {
                var len = base.length;
                var baseId = this.idManager.findObjId(base);
                if (typeof len === 'number' && baseId !== -1) {
                    // NOTE this will emit a putfield at '0' even if the
                    // array was empty before; shouldn't be a big deal
                    this.logger.logPutfield(iid, baseId, String(len), 0);
                }
            },
            'Array.prototype.unshift': (iid,f,base,args,val,isConstructor,name) => {
                // we need to do a full pass to update all indices
                var len = base.length;
                var baseId = this.idManager.findObjId(base);
                if (typeof len === 'number' && baseId !== -1) {
                    for (var i = 0; i < len; i++) {
                        // TODO base[i] could be a getter...sigh.  ignore for now
                        var elemId = this.idManager.findObjId(base[i]);
                        if (elemId === -1) {
                            // to be safe, still log a putfield with null id
                            elemId = 0;
                        }
                        this.logger.logPutfield(iid, baseId,String(i),elemId);
                    }
                }
            },
            'Array.prototype.shift': (iid,f,base,args,val,isConstructor,name) => {
                // we need to do a full pass to update all indices
                var len = base.length;
                var baseId = this.idManager.findObjId(base);
                if (typeof len === 'number' && baseId !== -1) {
                    for (var i = 0; i < len; i++) {
                        // TODO base[i] could be a getter...sigh.  ignore for now
                        var elemId = this.idManager.findObjId(base[i]);
                        if (elemId === -1) {
                            // to be safe, still log a putfield with null id
                            elemId = 0;
                        }
                        this.logger.logPutfield(iid, baseId,String(i),elemId);
                    }
                    // also, putfield of null at length to reflect shifted value
                    // NOTE this will emit a putfield at '0' even if the
                    // array was empty before; shouldn't be a big deal
                    this.logger.logPutfield(iid, baseId, String(len), 0);
                }
            },
            'Array.prototype.concat': (iid,f,base,args,val,isConstructor,name) => {
                // full pass on result
                if (val) {
                    // need to wrap eagerly
                    var valId = this.idManager.findOrCreateUniqueId(val, iid, false);
                    var len = val.length;
                    if (typeof len === 'number') {
                        for (var i = 0; i < len; i++) {
                            var elemId = this.idManager.findObjId(val[i]);
                            if (elemId !== -1) {
                                this.logger.logPutfield(iid, valId, String(i), elemId);
                            }
                        }
                    }
                }
            },
            'Array.prototype.splice': (iid,f,base,args,val,isConstructor,name) => {
                // full pass on array
                var len = base.length;

                var baseId = this.idManager.findObjId(base);
                if (typeof len === 'number' && baseId !== -1) {
                    for (var i = 0; i < len; i++) {
                        // TODO base[i] could be a getter...sigh.  ignore for now
                        var elemId = this.idManager.findObjId(base[i]);
                        if (elemId === -1) {
                            // to be safe, still log a putfield with null id
                            elemId = 0;
                        }
                        this.logger.logPutfield(iid, baseId, String(i), elemId);
                    }
                    // if old length was bigger than current length, need to emit putfields
                    // of null to extra elements
                    var oldLen = this.spliceOldLen;
                    if (typeof oldLen === 'number' && oldLen > len) {
                        for (i = len; i < oldLen; i++) {
                            this.logger.logPutfield(iid,baseId,String(i),0);
                        }
                    }
                    this.spliceOldLen = undefined;
                }
                // full pass on result
                if (val) {
                    var len = val.length;
                    if (len > 0) {
                        // need to wrap eagerly
                        var valId = this.idManager.findOrCreateUniqueId(val, iid, false);
                        for (var i = 0; i < len; i++) {
                            var elemId = this.idManager.findObjId(val[i]);
                            if (elemId !== -1) {
                                this.logger.logPutfield(iid, valId, String(i), elemId);
                            }
                        }
                    }
                }
            },
            'setTimeout': (iid,f,base,args,val,isConstructor,name) => {
                var wrapperFun = args[0];
                var globalName = wrapperFun.globalName;
                var timeoutId = val;
                this.callbackIdToGlobal.set(timeoutId, globalName);
                wrapperFun.timeoutId = timeoutId;
            },
            'clearTimeout': (iid,f,base,args,val,isConstructor,name) => {
                var timeoutId = args[0];
                var global = this.callbackIdToGlobal.get(timeoutId);
                if (global) {
                    this.logger.logWrite(iid, global, 0);
                    this.logger.setFlushIID(iid);
                    this.callbackIdToGlobal.delete(timeoutId);
                }
            },
            'setInterval': (iid,f,base,args,val,isConstructor,name) => {
                var intervalFun = args[0];
                var globalName = "~timer~global~" + (++this.callbackCounter);
                var timeoutId = val;
                this.callbackIdToGlobal.set(timeoutId, globalName);
                this.logger.logWrite(iid, globalName, this.idManager.findOrCreateUniqueId(intervalFun, iid, false));
            },
            'clearInterval': (iid,f,base,args,val,isConstructor,name) => {
                var timeoutId = args[0];
                var global = this.callbackIdToGlobal.get(timeoutId);
                if (global) {
                    this.logger.logWrite(iid, global, 0);
                    this.logger.setFlushIID(iid);
                    this.callbackIdToGlobal.delete(timeoutId);
                }
            },
            'addEventListener': (iid,f,base,args,val,isConstructor,name) => {
                // add to child set for event name
                var eventType = args[0];
                var listenerFun = args[1];
                if (base && isObject(base) && eventType && typeof eventType === 'string' && listenerFun) {
                    var parentId = this.idManager.findOrCreateUniqueId(base,iid,false);
                    var childId = this.idManager.findOrCreateUniqueId(listenerFun,iid,false);
                    var name = "~event~" + eventType;
                    this.logger.logAddToChildSet(iid, parentId, name, childId);
                }
            },
            'removeEventListener': (iid,f,base,args,val,isConstructor,name) => {
                // add to child set for event name
                var eventType = args[0];
                var listenerFun = args[1];
                if (base && isObject(base) && eventType && typeof eventType === 'string' && listenerFun) {
                    var parentId = this.idManager.findOrCreateUniqueId(base,iid,false);
                    var childId = this.idManager.findOrCreateUniqueId(listenerFun,iid,false);
                    var name = "~event~" + eventType;
                    this.logger.logRemoveFromChildSet(iid, parentId, name, childId);
                }
            },
            'Object.defineProperty': (iid,f,base,args,val,isConstructor,name) => {
                var targetObj = args[0];
                var property = String(args[1]);
                var descriptor = args[2];
                if (targetObj && isObject(targetObj) && property && descriptor) {
                    var targetId = this.idManager.findOrCreateUniqueId(targetObj, iid, false);
                    if (HOP(descriptor, 'value')) {
                        var val = descriptor.value;
                        if (isObject(val)) {
                            var valId = this.idManager.findOrCreateUniqueId(val, iid, false);
                            this.logger.logPutfield(iid, targetId, property, valId);
                        } else {
                            // still log a write in case it's an overwrite
                            this.logger.logPutfield(iid, targetId, property, 0);
                        }
                    }
                    if (HOP(descriptor, 'get')) {
                        var getter = descriptor.get;
                        var getterId = this.idManager.findOrCreateUniqueId(getter, iid, false);
                        this.logger.logPutfield(iid, targetId, "~get~" + property, getterId);
                    }
                    if (HOP(descriptor, 'set')) {
                        var setter = descriptor.set;
                        var setterId = this.idManager.findOrCreateUniqueId(setter, iid, false);
                        this.logger.logPutfield(iid, targetId, "~set~" + property, setterId);
                    }
                }
            },
            'HTMLElement.prototype.insertAdjacentHTML': (iid,f,base,args,val,isConstructor,name) => {
                /**
                 *
                 If position is an ASCII case-insensitive match for the string "beforebegin"

                 Insert fragment into the context object's parent before the context object.
                 If position is an ASCII case-insensitive match for the string "afterbegin"

                 Insert fragment into the context object before its first child.
                 If position is an ASCII case-insensitive match for the string "beforeend"

                 Append fragment to the context object.
                 If position is an ASCII case-insensitive match for the string "afterend"

                 Insert fragment into the context object's parent before the context object's next sibling.
                 */
                var position = args[0];
                if (position && typeof position === 'string') {
                    var posLowerCase = position.toLowerCase();
                    if (posLowerCase === 'beforebegin' || posLowerCase === 'afterend') {
                        var parent = base.parentNode;
                        this.mutObs.createDOMNodeDescendants(parent, iid);
                    } else if (posLowerCase === 'afterbegin' || posLowerCase === 'beforeend') {
                        this.mutObs.createDOMNodeDescendants(base, iid);
                    }
                }
            }

        };

    }
}