/*
 * Copyright 2014 Samsung Information Systems America, Inc.
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
package com.samsung.memoryanalysis.staleness;

import java.io.DataOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.reflect.Type;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import com.ibm.wala.util.collections.HashMapFactory;
import com.ibm.wala.util.collections.HashSetFactory;
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.context.ContextProvider;
import com.samsung.memoryanalysis.referencecounter.UnreachabilityAwareAnalysis;
import com.samsung.memoryanalysis.staleness.ObjectStaleness.ObjectType;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 * staleness analysis that streams its output
 *
 * @author m.sridharan
 *
 */
public class StreamingStalenessAnalysis implements
        UnreachabilityAwareAnalysis<Void> {

    private static final int UNKNOWN_TIME = 0;

    public boolean debug = false;

    /**
     * data on the allocation site and type of an object
     *
     */
    static class AllocInfo {

        final ObjectType type;
        SourceLocId allocationIID;
        final long creationTime;
        List<SourceLocId> creationCallStack;

        public AllocInfo(ObjectType type, SourceLocId allocationIID,
                long creationTime, List<SourceLocId> creationCallStack) {
            super();
            this.type = type;
            this.allocationIID = allocationIID;
            this.creationTime = creationTime;
            this.creationCallStack = creationCallStack;
        }

    }

    /**
     * data on when an object is last used and becomes unreachable
     */
    static class LastUseUnreachableInfo {
        final int objectId;
        long mostRecentUseTime;
        SourceLocId mostRecentUseSite = SourceMap.UNKNOWN_ID;
        long unreachableTime;
        SourceLocId unreachableSite = SourceMap.UNKNOWN_ID;

        public LastUseUnreachableInfo(int objId) {
            this.objectId = objId;
        }
    }

    private final Map<Integer, AllocInfo> live = HashMapFactory.make();

    /**
     * unreachable objects for which we have yet to flush a record
     */
    private final Map<Integer, AllocInfo> unreachable = HashMapFactory.make();

    private final ArrayList<LastUseUnreachableInfo> lastUseUnreachInfo = new ArrayList<LastUseUnreachableInfo>(
            10000);
    private final PrintStream out;

    private final DataOutputStream lastUseOut;
    private final DataOutputStream unreachOut;

    private SourceMap sourceMap;

    private Gson gson;

    private final Deque<SourceLocId> currentCallStack = new ArrayDeque<SourceLocId>();

    private List<SourceLocId> callStackAsList() {
        return new ArrayList<SourceLocId>(currentCallStack);
    }

    public StreamingStalenessAnalysis(OutputStream out,
            OutputStream lastUseOut, OutputStream unreachOut) {
        this.out = new PrintStream(out);
        this.lastUseOut = new DataOutputStream(lastUseOut);
        this.unreachOut = new DataOutputStream(unreachOut);
        gson = new GsonBuilder().registerTypeAdapter(SourceLocId.class,
                new SourceLocSerializer()).create();
    }

    @Override
    public void init(Timer timer, SourceMap sourceMap) {
        this.sourceMap = sourceMap;
    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId) {
        // do nothing
    }

    @Override
    public void create(SourceLocId slId, int objectId, long time, boolean isDom) {
        if (objectId != ContextProvider.GLOBAL_OBJECT_ID) {
            this.live.put(objectId, new AllocInfo(
                    isDom ? ObjectStaleness.ObjectType.DOM
                            : ObjectStaleness.ObjectType.OBJECT, slId, time,
                    callStackAsList()));
        }
    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId,
            SourceLocId functionEnterIID,
            Set<String> namesReferencedByClosures, Context context, long time) {
        List<SourceLocId> callstack = callStackAsList();
        this.live.put(objectId, new AllocInfo(ObjectType.FUNCTION, slId, time,
                callstack));
        this.live.put(prototypeId, new AllocInfo(ObjectType.PROTOTYPE, slId,
                time, callstack));
    }

    @Override
    public void putField(SourceLocId slId, int baseId, String offset,
            int objectId) {
        // do nothing
    }

    @Override
    public void write(SourceLocId slId, String name, int objectId) {
        // do nothing
    }

    @Override
    public void lastUse(int objectId, SourceLocId slId, long time) {
        if (objectId == ContextProvider.GLOBAL_OBJECT_ID)
            return;
        LastUseUnreachableInfo info = getLastUseUnreachableInfo(objectId);
        info.mostRecentUseTime = time;
        info.mostRecentUseSite = slId;
        if (info.unreachableTime > 0 && info.unreachableTime < time) {
            // we already set an unreachable time, but now we've observed
            // another use.  it is possible that we will not see another
            // unreachability callback (e.g., if the object is just used but
            // no reference is stored).  So, as a hack, update the unreachable
            // time and site to the current time and site.
            info.unreachableTime = time;
            info.unreachableSite = slId;
        }
    }

    private LastUseUnreachableInfo getLastUseUnreachableInfo(int objectId) {
        int size = lastUseUnreachInfo.size();
        if (objectId >= size) {
            // pad it out with nulls
            int padding = (objectId + 1) - size;
            lastUseUnreachInfo.addAll(Collections
                    .<LastUseUnreachableInfo> nCopies(padding, null));
        }
        LastUseUnreachableInfo info = lastUseUnreachInfo.get(objectId);
        if (info == null) {
            info = new LastUseUnreachableInfo(objectId);
            lastUseUnreachInfo.set(objectId, info);
        }
        return info;
    }

    @Override
    public void functionEnter(SourceLocId slId, int funId,
            SourceLocId callSiteIID, Context newContext, long time) {
        currentCallStack.push(callSiteIID);
    }

    @Override
    public void functionExit(SourceLocId slId, Context functionContext,
            Set<String> unReferenced, long time) {
        currentCallStack.pop();
    }

    @Override
    public void topLevelFlush(SourceLocId slId) {
        // do nothing
    }

    @Override
    public void updateIID(int objId, SourceLocId newIID) {
        AllocInfo objInfo = live.get(objId);
        assert objInfo != null;
        objInfo.allocationIID = newIID;
        objInfo.creationCallStack = callStackAsList();
    }

    @Override
    public void debug(SourceLocId slId, int oid) {
        // do nothing
    }

    @Override
    public void returnStmt(int objId) {
        // do nothing
    }

    /**
     * keep track of DOM tree, since nodes in the tree should not be marked as
     * stale
     */
    private final Map<Integer, Set<Integer>> domParent2Children = HashMapFactory
            .make();

    @Override
    public void addDOMChild(int parentId, int childId, long time) {
        Set<Integer> children = domParent2Children.get(parentId);
        if (children != null) { // in the tree
            children.add(childId);
            if (!domParent2Children.containsKey(childId)) {
                domParent2Children
                        .put(childId, HashSetFactory.<Integer> make());
            }
            // we also know that the DOM child is live. if it is not
            // recorded as such, add a revived record for it
            if (!live.containsKey(childId)) {
                AllocInfo objInfo = new AllocInfo(ObjectType.DOM,
                        SourceMap.UNKNOWN_ID, UNKNOWN_TIME, Collections.<SourceLocId>emptyList());
                live.put(childId, objInfo);
            }
        }
    }

    @Override
    public void removeDOMChild(int parentId, int childId, long time) {
        Set<Integer> children = domParent2Children.get(parentId);
        if (children != null) { // in the tree
            assert children.contains(childId);
            children.remove(childId);
            // update last use times of nodes reachable from child
            LinkedList<Integer> worklist = new LinkedList<Integer>();
            worklist.push(childId);
            while (!worklist.isEmpty()) {
                Integer curNode = worklist.removeFirst();
                LastUseUnreachableInfo info = getLastUseUnreachableInfo(curNode);
                info.mostRecentUseTime = time;
                info.mostRecentUseSite = SourceMap.REMOVE_FROM_DOM_SITE;
                Set<Integer> curChildren = domParent2Children.get(curNode);
                assert curChildren != null;
                worklist.addAll(curChildren);
                domParent2Children.remove(curNode);
            }
        }
    }

    @Override
    public void addToChildSet(SourceLocId slId, int parentId, String name,
            int childId) {
        // do nothing
    }

    @Override
    public void removeFromChildSet(SourceLocId slId, int parentId, String name,
            int childId) {
        // do nothing
    }

    @Override
    public void domRoot(int nodeId) {
        domParent2Children.put(nodeId, HashSetFactory.<Integer> make());
    }

    @Override
    public void scriptEnter(SourceLocId slId, String filename) {
        // do nothing
    }

    @Override
    public void scriptExit(SourceLocId slId) {
        // do nothing
    }

    @Override
    public void unreachableObject(SourceLocId slId, int objectId, long time,
            int shallowSize) {
        LastUseUnreachableInfo lastUseInfo = getLastUseUnreachableInfo(objectId);
        lastUseInfo.unreachableTime = time;
        lastUseInfo.unreachableSite = slId;
        if (domParent2Children.containsKey(objectId)) {
            // still in the live DOM, so treat this point as its last use time
            lastUseInfo.mostRecentUseTime = time;
            lastUseInfo.mostRecentUseSite = slId;
            domParent2Children.remove(objectId);
        }
        AllocInfo allocInfo = null;
        if (live.containsKey(objectId)) {
            allocInfo = live.get(objectId);
            live.remove(objectId);
        } else if (unreachable.containsKey(objectId)) {
            // it's a revived object, but we didn't flush the unreachable record
            // yet
            allocInfo = unreachable.get(objectId);
        } else {
            // this can happen in rare cases, e.g., for the document object
            allocInfo = new AllocInfo(ObjectType.DOM, SourceMap.UNKNOWN_ID,
                    UNKNOWN_TIME, Collections.<SourceLocId>emptyList());
        }
        unreachable.put(objectId, allocInfo);
    }

    @Override
    public void unreachableContext(SourceLocId slId, Context ctx, long time) {
        // do nothing
    }

    @Override
    public void endLastUse() {
        // flush record for each unreachable object
        flushUnreachable();
    }

    private void flushUnreachable() {
        for (Entry<Integer, AllocInfo> entry : unreachable.entrySet()) {
            int objectId = entry.getKey();
            this.writeObjEntry(objectId, entry.getValue(),
                    lastUseUnreachInfo.get(objectId));
        }
        unreachable.clear();
    }

    private class SourceLocSerializer implements JsonSerializer<SourceLocId> {

        @Override
        public JsonElement serialize(SourceLocId src, Type typeOfSrc,
                JsonSerializationContext context) {
            return new JsonPrimitive(sourceMap.get(src).toString());
        }

    }

    private void writeObjEntry(int objectId, AllocInfo allocInfo,
            LastUseUnreachableInfo lastUseUnreachInfo) {
        Object[] entry = new Object[] { objectId, allocInfo.type.toString(),
                allocInfo.allocationIID, allocInfo.creationTime,
                allocInfo.creationCallStack,
                lastUseUnreachInfo.mostRecentUseTime,
                lastUseUnreachInfo.mostRecentUseSite,
                lastUseUnreachInfo.unreachableTime,
                lastUseUnreachInfo.unreachableSite };
        out.println(gson.toJson(entry));

    }

    @Override
    public Void endExecution(long time) {
        assert live.isEmpty();
        flushUnreachable();
        Comparator<LastUseUnreachableInfo> lastUseCompare = new Comparator<StreamingStalenessAnalysis.LastUseUnreachableInfo>() {

            @Override
            public int compare(LastUseUnreachableInfo o1,
                    LastUseUnreachableInfo o2) {
                if (o1 == null || o1.mostRecentUseTime == 0) {
                    if (o2 == null || o2.mostRecentUseTime == 0) {
                        return 0;
                    } else {
                        return 1;
                    }
                } else if (o2 == null || o2.mostRecentUseTime == 0)
                    return -1;
                long diff = o1.mostRecentUseTime - o2.mostRecentUseTime;
                return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
            }
        };
        Collections.sort(lastUseUnreachInfo, lastUseCompare);
        if (debug)
            out.println("last use");
        for (LastUseUnreachableInfo info : lastUseUnreachInfo) {
            if (info == null || info.mostRecentUseTime == 0)
                break;
            if (debug) {
                Object[] entry = new Object[] { info.objectId,
                        info.mostRecentUseTime, info.mostRecentUseSite };
                out.println(gson.toJson(entry));
            }
            try {
                lastUseOut.writeInt(info.objectId);
                lastUseOut.writeLong(info.mostRecentUseTime);
                lastUseOut.writeInt(info.mostRecentUseSite.getSourceFileId());
                lastUseOut.writeInt(info.mostRecentUseSite.getIid());
            } catch (IOException e) {
                throw new Error("I/O error", e);
            }

        }
        Comparator<LastUseUnreachableInfo> unreachCompare = new Comparator<StreamingStalenessAnalysis.LastUseUnreachableInfo>() {

            @Override
            public int compare(LastUseUnreachableInfo o1,
                    LastUseUnreachableInfo o2) {
                if (o1 == null) {
                    if (o2 == null) {
                        return 0;
                    } else {
                        return 1;
                    }
                } else if (o2 == null) {
                    return -1;
                }
                long diff = o1.unreachableTime - o2.unreachableTime;
                return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
            }
        };
        Collections.sort(lastUseUnreachInfo, unreachCompare);
        if (debug)
            out.println("unreachable");
        for (LastUseUnreachableInfo info : lastUseUnreachInfo) {
            if (info == null)
                break;
            if (debug) {
                Object[] entry = new Object[] { info.objectId,
                        info.unreachableTime, info.unreachableSite };
                out.println(gson.toJson(entry));
            }
            try {
                unreachOut.writeInt(info.objectId);
                unreachOut.writeLong(info.unreachableTime);
                unreachOut.writeInt(info.unreachableSite.getSourceFileId());
                unreachOut.writeInt(info.unreachableSite.getIid());
            } catch (IOException e) {
                throw new Error("I/O error", e);
            }

        }
        return null;
    }

}
