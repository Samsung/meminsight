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

///<reference path='./InstUtils.ts' />
///<reference path='./Loggers.ts' />
///<reference path='./LastUseManager.ts' />

/**
 * Created by m.sridharan on 11/6/14.
 */
module ___LoggingAnalysis___ {

    export interface ObjIdManager {

        findOrCreateUniqueId(obj: any, iid: number, isLiteral: boolean): number

        extractObjId(metadata: number): number

        isUnannotatedThis(metadata: number): boolean

        setUnannotatedThis(metadata: number): number

        /**
         * gets unique id for object.  assumes that an ID has already been created.
         * @param obj
         * @returns {number}
         */
        findExtantObjId(obj: any): number

        /**
         * gets unique id for obj.  if obj is not an object or if it has
         * no id, return -1
         * @param obj
         */
        findObjId(obj: any): number

        /**
         * is obj unannotated and in need of an id?  This is to handle
         * cases where we discover objects from native / uninstrumented code
         * @param obj
         */
        needsAnId(obj: any): boolean

        hasMetadata(obj: any): boolean

        getMetadata(obj: any): number

        setMetadata(obj: any, metadata: number): void

        setIIDForNativeObj(obj: any, iid: number): void

        flushNativeObj2IIDInfo(): void

    }

    interface MetadataManager {

        hasMetadata(obj: any): boolean

        getMetadata(obj: any): number

        setMetadata(obj: any, metadata: number): void

        setIIDForNativeObj(obj: any, iid: number): void
        hasIIDForNativeObj(obj: any): boolean
        getIIDForNativeObj(obj: any): number

        flushNativeObj2IIDInfo(): void
    }

    class WeakMapMetadataManager implements MetadataManager {
        /**
         * WeakMap to hold the IID at which we first encountered a native object.
         *
         * This is used to associate a correct IID with the native object if we
         * decide to create metadata for it.
         * @type {WeakMap<K, V>}
         */
        private nativeObj2IID = new WeakMap<any,number>();



        /**
         * WeakMap to hold object metadata
         * metadata is 32 bits.  31 bits for object id, highest-order bit to mark unannotated 'this'
         * objects from constructors
         * @type {WeakMap<K, V>}
         */
        private obj2Metadata = new WeakMap<any,number>();


        hasMetadata(obj:any):boolean {
            return this.obj2Metadata.has(obj);
        }

        getMetadata(obj:any):number {
            return this.obj2Metadata.get(obj);
        }

        setMetadata(obj:any, metadata:number):void {
            this.obj2Metadata.set(obj,metadata);
        }

        setIIDForNativeObj(obj:any, iid:number):void {
            this.nativeObj2IID.set(obj,iid);
        }

        hasIIDForNativeObj(obj:any):boolean {
            return this.nativeObj2IID.has(obj);
        }

        getIIDForNativeObj(obj:any):number {
            return this.nativeObj2IID.get(obj);
        }


        flushNativeObj2IIDInfo():void {
            this.nativeObj2IID = new WeakMap<any,number>();
        }

    }

    class HiddenPropMetadataManager implements MetadataManager {

        private static METADATA_PROP = "*M$*";
        private static NATIVE_IID_PROP = "*NI$*";

        constructor() {
            if (typeof Object.defineProperty !== 'function') {
                throw new Error("we need Object.defineProperty");
            }
        }
        hasMetadata(obj:any):boolean {
            return HOP(obj, HiddenPropMetadataManager.METADATA_PROP);
        }

        getMetadata(obj:any):number {
            return obj[HiddenPropMetadataManager.METADATA_PROP];
        }

        setMetadata(obj:any, metadata:number):void {
            if (!this.hasMetadata(obj)) {
                try {
                    objDefineProperty(obj, HiddenPropMetadataManager.METADATA_PROP, {
                        enumerable: false,
                        writable: true
                    })
                } catch (e) {
                    // this can happen on older browsers that do not support
                    // Object.defineProperty on all objects.  We ignore it and
                    // hope for the best.  In the worst case, some code that enumerates
                    // the properties of the object in question might break.
                }
            }
            obj[HiddenPropMetadataManager.METADATA_PROP] = metadata;
        }

        setIIDForNativeObj(obj:any, iid:number):void {
            objDefineProperty(obj, HiddenPropMetadataManager.NATIVE_IID_PROP, {
                enumerable: false,
                writable: true
            });
            obj[HiddenPropMetadataManager.NATIVE_IID_PROP] = iid;
        }

        hasIIDForNativeObj(obj:any):boolean {
            return HOP(obj, HiddenPropMetadataManager.NATIVE_IID_PROP);
        }

        getIIDForNativeObj(obj:any):number {
            return obj[HiddenPropMetadataManager.NATIVE_IID_PROP];
        }

        flushNativeObj2IIDInfo():void {
            // do nothing
        }

    }


    class ObjIdManagerImpl implements ObjIdManager {
        /**
         * counter for object ids
         * @type {number}
         */
        private idCounter = 0;

        private logger: Logger;
        private lastUse: LastUseManager;
        private metaManager: MetadataManager;

        constructor(logger: Logger,
                    lastUse: LastUseManager,
                    metaManager: MetadataManager) {
            this.logger = logger;
            this.lastUse = lastUse;
            this.metaManager = metaManager;
        }
        /**
         * get a unique id for the object, creating it if necessary.
         * If created, log a CREATE event
         * @param obj the object, precondition isObject(obj) === true
         * @returns {*}
         */
        findOrCreateUniqueId(obj: any, iid: number, isLiteral: boolean): number {

            var meta = this.metaManager;
            if (meta.hasMetadata(obj)) {
                return this.extractObjId(meta.getMetadata(obj));
            } else {
                return this.createObjId(obj, iid, isLiteral);
            }
        }

        extractObjId(metadata: number): number {
            return metadata & 0x7FFFFFFF;
        }

        isUnannotatedThis(metadata: number): boolean {
            return metadata < 0;
        }

        setUnannotatedThis(metadata: number): number {
            // set sign bit
            return metadata | 0x80000000;
        }


        /**
         * gets unique id for object.  assumes that an ID has already been created.
         * @param obj
         * @returns {number}
         */
        findExtantObjId(obj: any) {
            return this.extractObjId(this.metaManager.getMetadata(obj));
        }

        findObjId(obj: any) {
            if (isObject(obj)) {
                var val = this.metaManager.getMetadata(obj);
                if (val !== undefined) {
                    return this.extractObjId(val);
                }
            }
            return -1;
        }

        /**
         * is obj unannotated and in need of an id?  This is to handle
         * cases where we discover objects from native / uninstrumented code
         * @param obj
         */
        needsAnId(obj: any): boolean {
            return isObject(obj) && !this.metaManager.hasMetadata(obj);
        }

        createObjId(obj: any, iid: number, isLiteral: boolean): number {
            var meta = this.metaManager;
            if (meta.hasIIDForNativeObj(obj)) {
                // use the better IID that we stashed away
                iid = meta.getIIDForNativeObj(obj);
            }
            var helper = (o: any) => {
                var objId = this.idCounter + 1;
                meta.setMetadata(o, objId);
                this.lastUse.updateLastUse(objId, iid, -1);
                this.idCounter = objId;
                return objId;
            };
            var objId = helper(obj);
            // only emit the CREATE_FUN entry for function literals
            if (isLiteral && typeof obj === 'function') {
                // create ID for prototype as well
                var proto = obj.prototype;
                var protoId = helper(proto);
                var funEnterIID:number = getFunEnterIID(obj);
                this.logger.logCreateFun(iid, funEnterIID, objId);
            } else if (isBrowser && obj instanceof Node) {
                this.logger.logCreateDOMNode(iid, objId);
            } else {
                this.logger.logCreateObj(iid, objId);
            }
            return objId;
        }

        /**
         * do we have metadata for the object already?
         * @param obj
         * @returns {boolean}
         */
        hasMetadata(obj: any): boolean {
            return this.metaManager.hasMetadata(obj);
        }

        getMetadata(obj: any) {
            return this.metaManager.getMetadata(obj);
        }
        setMetadata(obj: any, id: number) {
            return this.metaManager.setMetadata(obj, id);
        }

        flushNativeObj2IIDInfo() {
            this.metaManager.flushNativeObj2IIDInfo();
        }

        setIIDForNativeObj(obj, iid) {
            this.metaManager.setIIDForNativeObj(obj,iid);
        }
    }


    export function createObjIdManager(logger: Logger, lastUse: LastUseManager, useHiddenProp = false): ObjIdManager {
        var result =
            typeof WeakMap === 'undefined' || useHiddenProp ?
                new ObjIdManagerImpl(logger, lastUse, new HiddenPropMetadataManager()) :
                new ObjIdManagerImpl(logger, lastUse, new WeakMapMetadataManager());
        // reserve object ID 1 for the global object
        result.createObjId(GLOBAL_OBJ, -1, false);
        return result;
    }


}