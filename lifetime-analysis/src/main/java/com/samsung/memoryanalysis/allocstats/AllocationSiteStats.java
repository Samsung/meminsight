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
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.referencecounter.UnreachabilityAwareAnalysis;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;

public class AllocationSiteStats implements UnreachabilityAwareAnalysis<Void> {

    static class ObjMetadata {

        List<Pair<SourceLocId,Integer>> creationIndex;
    }

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
    @Override
    public void init(Timer timer, SourceMap iidMap) {
        this.timer = timer;
    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId) {
        // TODO Auto-generated method stub

    }

    private void createObj(SourceLocId slId, int objectId) {
        assert !objId2Metadata.containsKey(objectId);
        ObjMetadata m = new ObjMetadata();
        objId2Metadata.put(objectId, m);
        executionIndex.inc(slId);
        m.creationIndex = executionIndex.getIndex();
    }
    @Override
    public void create(SourceLocId slId, int objectId, long time, boolean isDom) {
        createObj(slId, objectId);
    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId,
            SourceLocId functionEnterIID,
            Set<String> namesReferencedByClosures, Context context, long time) {
        // TODO Auto-generated method stub

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
        SourceLocId allocId = getAllocId(objMetadata.creationIndex);
        SiteMetadata siteMetadata = slId2Metadata.get(allocId);
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
            SourceLocId callSiteIID, Context newContext, long time) {
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
    public void functionExit(SourceLocId slId, Context functionContext,
            Set<String> unReferenced, long time) {
        handleFunExit();
    }

    @Override
    public void topLevelFlush(SourceLocId slId) {
        // TODO Auto-generated method stub

    }

    @Override
    public void updateIID(int objId, SourceLocId newIID) {
        // TODO Auto-generated method stub

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
    public void addDOMChild(int parentId, int childId, long time) {
        // TODO Auto-generated method stub

    }

    @Override
    public void removeDOMChild(int parentId, int childId, long time) {
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
    public void unreachableObject(SourceLocId slId, int objectId, long time,
            int shallowSize) {
        ObjMetadata objMetadata = objId2Metadata.get(objectId);
        SourceLocId allocId = getAllocId(objMetadata.creationIndex);
        SiteMetadata siteMetadata = slId2Metadata.get(allocId);
        siteMetadata.currentStaleCount--;
        objId2Metadata.remove(objectId);
    }

    @Override
    public void unreachableContext(SourceLocId slId, Context ctx, long time) {
        // TODO Auto-generated method stub

    }

    @Override
    public Void endExecution(long time) {
        // TODO Auto-generated method stub
        return null;
    }

}
