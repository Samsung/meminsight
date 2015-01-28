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

import com.ibm.wala.util.collections.Pair;
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;


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
    public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteIID, Context newContext, long time) {
        first.functionEnter(slId,funId,callSiteIID,newContext,time);
        second.functionEnter(slId,funId,callSiteIID,newContext,time);
    }

    @Override
    public void init(Timer t, SourceMap iidMap) {
        first.init(t, iidMap);
        second.init(t, iidMap);
    }

    @Override
    public void create(SourceLocId slId, int objectId, long time, boolean isDom) {
        first.create(slId,objectId,time,isDom);
        second.create(slId,objectId,time,isDom);
    }

    @Override
    public void unreachableObject(SourceLocId slId, int objectId, long time, int shallowSize) {
        first.unreachableObject(slId,objectId,time,shallowSize);
        second.unreachableObject(slId,objectId,time,shallowSize);
    }

    @Override
    public void unreachableContext(SourceLocId slId, Context ctx, long time) {
        first.unreachableContext(slId,ctx,time);
        second.unreachableContext(slId,ctx,time);
    }

    @Override
    public void lastUse(int objectId, SourceLocId slId, long time) {
        first.lastUse(objectId, slId, time);
        second.lastUse(objectId, slId, time);
    }

    @Override
    public Pair<T, V> endExecution(long time) {
        return Pair.make(first.endExecution(time), second.endExecution(time));
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
    public void putField(SourceLocId slId, int baseId, String offset, int objectId) {
        first.putField(slId, baseId, offset, objectId);
        second.putField(slId, baseId, offset ,objectId);
    }

    @Override
    public void write(SourceLocId slId, String name, int objectId) {
        first.write(slId, name, objectId);
        second.write(slId, name, objectId);
    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId) {
        first.declare(slId, name, objectId);
        second.declare(slId, name, objectId);
    }

    @Override
    public void updateIID(int objId, SourceLocId newIID) {
        first.updateIID(objId, newIID);
        second.updateIID(objId, newIID);
    }

    @Override
    public void returnStmt(int objId) {
        first.returnStmt(objId);
        second.returnStmt(objId);
    }

    @Override
    public void debug(SourceLocId slId, int oid) {
        first.debug(slId, oid);
        second.debug(slId, oid);
    }

    @Override
    public void scriptEnter(SourceLocId slId, String filename) {
        first.scriptEnter(slId, filename);
        second.scriptEnter(slId, filename);
    }

    @Override
    public void scriptExit(SourceLocId slId) {
        first.scriptExit(slId);
        second.scriptExit(slId);
    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID, Set<String> namesReferencedByClosures, Context context, long time) {
        first.createFun(slId, objectId, prototypeId, functionEnterIID, namesReferencedByClosures, context, time);
        second.createFun(slId, objectId, prototypeId, functionEnterIID, namesReferencedByClosures, context, time);
    }

    @Override
    public void functionExit(SourceLocId slId, Context functionContext, Set<String> unReferenced, long time) {
        first.functionExit(slId, functionContext, unReferenced, time);
        second.functionExit(slId, functionContext, unReferenced, time);
    }

    @Override
    public void topLevelFlush(SourceLocId slId) {
        first.topLevelFlush(slId);
        second.topLevelFlush(slId);
    }

    @Override
    public void addToChildSet(SourceLocId slId, int parentId, String name, int childId) {
        first.addToChildSet(slId, parentId, name, childId);
        second.addToChildSet(slId, parentId, name, childId);
    }

    @Override
    public void removeFromChildSet(SourceLocId slId, int parentId, String name, int childId) {
        first.removeFromChildSet(slId, parentId, name, childId);
        second.removeFromChildSet(slId, parentId, name, childId);
    }

}
