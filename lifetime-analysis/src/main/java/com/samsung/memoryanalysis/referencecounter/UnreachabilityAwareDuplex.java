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
package com.samsung.memoryanalysis.referencecounter;

import java.util.Set;

import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.traceparser.Timer;
import com.samsung.memoryanalysis.util.Pair;


public class UnreachabilityAwareDuplex<T,V> implements UnreachabilityAwareAnalysis<Pair<T,V>> {

    private UnreachabilityAwareAnalysis<T> first;
    private UnreachabilityAwareAnalysis<V> second;

    public UnreachabilityAwareDuplex(UnreachabilityAwareAnalysis<T> first, UnreachabilityAwareAnalysis<V> second) {
        assert first != null;
        assert second != null;
        this.first = first;
        this.second = second;
    }

    @Override
    public void functionEnter(int iid, int funId, int callSiteIID, Context newContext, long time) {
        first.functionEnter(iid,funId,callSiteIID,newContext,time);
        second.functionEnter(iid,funId,callSiteIID,newContext,time);
    }

    @Override
    public void init(Timer t, IIDMap iidMap) {
        first.init(t, iidMap);
        second.init(t, iidMap);
    }

    @Override
    public void create(int iid, int objectId, long time, boolean isDom) {
        first.create(iid,objectId,time,isDom);
        second.create(iid,objectId,time,isDom);
    }

    @Override
    public void unreachableObject(int iid, int objectId, long time, int shallowSize) {
        first.unreachableObject(iid,objectId,time,shallowSize);
        second.unreachableObject(iid,objectId,time,shallowSize);
    }

    @Override
    public void unreachableContext(int iid, Context ctx, long time) {
        first.unreachableContext(iid,ctx,time);
        second.unreachableContext(iid,ctx,time);
    }

    @Override
    public void lastUse(int objectId, int iid, long time) {
        first.lastUse(objectId, iid, time);
        second.lastUse(objectId, iid, time);
    }

    @Override
    public Pair<T, V> endExecution(long time) {
        return new Pair<T, V>(first.endExecution(time), second.endExecution(time));
    }

    @Override
    public void domRoot(int nodeId) {
        first.domRoot(nodeId);
        second.domRoot(nodeId);
    }

    @Override
    public void addDOMChild(int parentId, int childId, long time) {
        first.addDOMChild(parentId, childId, time);
        second.addDOMChild(parentId, childId, time);
    }

    @Override
    public void removeDOMChild(int parentId, int childId, long time) {
        first.removeDOMChild(parentId,childId,time);
        second.removeDOMChild(parentId,childId,time);
    }

    @Override
    public void putField(int iid, int baseId, String offset, int objectId) {
        first.putField(iid, baseId, offset, objectId);
        second.putField(iid, baseId, offset ,objectId);
    }

    @Override
    public void write(int iid, String name, int objectId) {
        first.write(iid, name, objectId);
        second.write(iid, name, objectId);
    }

    @Override
    public void declare(int iid, String name, int objectId) {
        first.declare(iid, name, objectId);
        second.declare(iid, name, objectId);
    }

    @Override
    public void updateIID(int objId, int newIID) {
        first.updateIID(objId, newIID);
        second.updateIID(objId, newIID);
    }

    @Override
    public void returnStmt(int objId) {
        first.returnStmt(objId);
        second.returnStmt(objId);
    }

    @Override
    public void debug(int iid, int oid) {
        first.debug(iid, oid);
        second.debug(iid, oid);
    }

    @Override
    public void scriptEnter(int iid, int sid, String filename) {
        first.scriptEnter(iid, sid, filename);
        second.scriptEnter(iid, sid, filename);
    }

    @Override
    public void scriptExit(int iid) {
        first.scriptExit(iid);
        second.scriptExit(iid);
    }

    @Override
    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID, Set<String> namesReferencedByClosures, Context context, long time) {
        first.createFun(iid, objectId, prototypeId, functionEnterIID, namesReferencedByClosures, context, time);
        second.createFun(iid, objectId, prototypeId, functionEnterIID, namesReferencedByClosures, context, time);
    }

    @Override
    public void functionExit(int iid, Context functionContext, Set<String> unReferenced, long time) {
        first.functionExit(iid, functionContext, unReferenced, time);
        second.functionExit(iid, functionContext, unReferenced, time);
    }

    @Override
    public void topLevelFlush(int iid) {
        first.topLevelFlush(iid);
        second.topLevelFlush(iid);
    }

    @Override
    public void addToChildSet(int iid, int parentId, String name, int childId) {
        first.addToChildSet(iid, parentId, name, childId);
        second.addToChildSet(iid, parentId, name, childId);
    }

    @Override
    public void removeFromChildSet(int iid, int parentId, String name, int childId) {
        first.removeFromChildSet(iid, parentId, name, childId);
        second.removeFromChildSet(iid, parentId, name, childId);
    }

}
