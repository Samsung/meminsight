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
package com.samsung.memoryanalysis.allocstats;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.ibm.wala.util.collections.HashMapFactory;
import com.ibm.wala.util.collections.Pair;
import com.samsung.memoryanalysis.traceparser.EnhancedTraceAnalysis;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;

public class AllocationSiteStats implements EnhancedTraceAnalysis<Void> {

    /**
     * per-object metadata.  we try to be careful to avoid leaking
     * this metadata, freeing all pointers to it once the corresponding
     * object becomes unreachable
     */
    static class ObjMetadata {

        List<Pair<SourceLocId,Integer>> creationIndex;
        boolean isStale;
    }


    /**
     * per-allocation-site metadata
     */
    static class SiteMetadata {

        int isIncreasing = -100;
        int emptyStackCount;
        int currentStaleCount;
        int oldStaleCount;
    }

    static class ExecutionIndex {

        static class Counters {
            final Map<SourceLocId,Integer> slId2Count = HashMapFactory.make();
            SourceLocId slId;
            int count;
        }

        private final Deque<Counters> counterStack = new ArrayDeque<Counters>();

        public ExecutionIndex() {
            counterStack.push(new Counters());
        }

        public void inc(SourceLocId slId) {
            Counters counters = counterStack.peek();
            Map<SourceLocId, Integer> slId2Count = counters.slId2Count;
            Integer c = slId2Count.get(slId);
            if (c == null) {
                c = 1;
            } else {
                c += 1;
            }
            slId2Count.put(slId, c);
            counters.slId = slId;
            counters.count = c;
        }

        public List<Pair<SourceLocId,Integer>> getIndex() {
            List<Pair<SourceLocId, Integer>> result = new ArrayList<Pair<SourceLocId,Integer>>(this.counterStack.size());
            Iterator<Counters> i = this.counterStack.descendingIterator();
            while (i.hasNext()) {
                Counters counters = i.next();
                result.add(Pair.make(counters.slId, counters.count));
            }
            return result;
        }

        public void call() {
            Counters newCounters = new Counters();
            counterStack.push(newCounters);
        }

        public void doReturn() {
            counterStack.pop();
        }
    }

    private final ExecutionIndex executionIndex = new ExecutionIndex();

    private final Map<Integer,ObjMetadata> objId2Metadata = HashMapFactory.make();

    private final Map<SourceLocId,SiteMetadata> slId2Metadata = HashMapFactory.make();

    private Timer timer;

    private SourceMap sourceMap;
    @Override
    public void init(Timer timer, SourceMap iidMap) {
        this.timer = timer;
        this.sourceMap = iidMap;
    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId) {
        // TODO Auto-generated method stub

    }

    private void createObj(SourceLocId slId, int objectId) {
        assert !objId2Metadata.containsKey(objectId);
        ObjMetadata m = new ObjMetadata();
        objId2Metadata.put(objectId, m);
        // TODO if IID was updated, this source location may not
        // be in the currently-executing function.  Is this a problem???
        executionIndex.inc(slId);
        m.creationIndex = executionIndex.getIndex();
    }

    @Override
    public void create(SourceLocId slId, int objectId) {
        createObj(slId, objectId);
    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId,
            SourceLocId functionEnterIID,
            Set<String> namesReferencedByClosures) {
        createObj(slId, objectId);
        createObj(slId, prototypeId);
    }

    @Override
    public void putField(SourceLocId slId, int baseId, String offset,
            int objectId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void write(SourceLocId slId, String name, int objectId) {
    }

    private SourceLocId getAllocId(List<Pair<SourceLocId,Integer>> execIndex) {
        return execIndex.get(execIndex.size()-1).fst;
    }
    @Override
    public void lastUse(int objectId, SourceLocId slId, long time) {
        ObjMetadata objMetadata = objId2Metadata.get(objectId);
        assert objMetadata != null : "never observed creation of object " + objectId;
        objMetadata.isStale = true;
        SourceLocId allocId = getAllocId(objMetadata.creationIndex);
        SiteMetadata siteMetadata = slId2Metadata.get(allocId);
        if (siteMetadata == null) {
            siteMetadata = new SiteMetadata();
            slId2Metadata.put(allocId, siteMetadata);
        }
        siteMetadata.currentStaleCount++;
    }

    private int callStackDepth = 0;

    private void handleFunEnter(SourceLocId callSiteId) {
        callStackDepth++;
        executionIndex.inc(callSiteId);
        executionIndex.call();
    }
    @Override
    public void functionEnter(SourceLocId slId, int funId,
            SourceLocId callSiteIID) {
        handleFunEnter(callSiteIID);
    }

    private void handleFunExit() {
        executionIndex.doReturn();
        callStackDepth--;
        if (callStackDepth == 0) {
            // check for increasing staleness in each allocation site
            for (SourceLocId slId: slId2Metadata.keySet()) {
                SiteMetadata sm = slId2Metadata.get(slId);
                if (sm.isIncreasing == -100 && sm.emptyStackCount > 0) {
                    if (sm.currentStaleCount > sm.oldStaleCount) {
                        sm.isIncreasing = 1;
                    } else if (sm.currentStaleCount < sm.oldStaleCount) {
                        sm.isIncreasing = -1;
                    } else {
                        sm.isIncreasing = 0;
                    }
                } else if (sm.isIncreasing >= 0) {
                    if (sm.currentStaleCount < sm.oldStaleCount) {
                        sm.isIncreasing = -1;
                    } else if (sm.currentStaleCount > sm.oldStaleCount) {
                        sm.isIncreasing++;
                    }
                }
                sm.oldStaleCount = sm.currentStaleCount;
                sm.emptyStackCount++;
            }
        }
    }
    @Override
    public void functionExit(SourceLocId slId) {
        handleFunExit();
    }

    @Override
    public void topLevelFlush(SourceLocId slId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void updateIID(int objId, SourceLocId newIID) {
        throw new Error("should never be called!");

    }

    @Override
    public void debug(SourceLocId slId, int oid) {
        // TODO Auto-generated method stub

    }

    @Override
    public void returnStmt(int objId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void addDOMChild(int parentId, int childId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void removeDOMChild(int parentId, int childId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void addToChildSet(SourceLocId slId, int parentId, String name,
            int childId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void removeFromChildSet(SourceLocId slId, int parentId, String name,
            int childId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void domRoot(int nodeId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void scriptEnter(SourceLocId slId, String filename) {
        handleFunEnter(slId);
    }

    @Override
    public void scriptExit(SourceLocId slId) {
        handleFunExit();
    }

    @Override
    public Void endExecution() {
        // all staleness counts should be zero
        for (SourceLocId slId: slId2Metadata.keySet()) {
            SiteMetadata sm = slId2Metadata.get(slId);
            assert sm.currentStaleCount == 0 : "non-zero stale count " + sm.currentStaleCount + " for site " + slId + " " + sourceMap.get(slId).toString();
            if (sm.isIncreasing > 1) {
                System.out.println("leaking site " + sourceMap.get(slId).toString());
            }
        }
        return null;
    }

    @Override
    public void endLastUse() {
        assert false: "this should never be called";
    }

    @Override
    public void createDomNode(SourceLocId slId, int objectId) {
        createObj(slId, objectId);
    }

    @Override
    public void unreachableObject(SourceLocId slId, int objectId) {
        ObjMetadata objMetadata = objId2Metadata.get(objectId);
        if (objMetadata.isStale) {
            // decrease the stale count for the allocation site
            SourceLocId allocId = getAllocId(objMetadata.creationIndex);
            SiteMetadata siteMetadata = slId2Metadata.get(allocId);
            assert siteMetadata != null : "no metadata for site " + sourceMap.get(allocId).toString() + " for object " + objectId;
            siteMetadata.currentStaleCount--;
            assert siteMetadata.currentStaleCount >= 0 : "negative stale count for " + sourceMap.get(allocId).toString();
        }
        objId2Metadata.remove(objectId);
    }

}
