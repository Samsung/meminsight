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
package com.samsung.memoryanalysis.staleness;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.ibm.wala.util.collections.HashMapFactory;
import com.ibm.wala.util.collections.HashSetFactory;
import com.ibm.wala.util.collections.MapUtil;
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.context.ContextProvider;
import com.samsung.memoryanalysis.referencecounter.UnreachabilityAwareAnalysis;
import com.samsung.memoryanalysis.staleness.ObjectStaleness.ObjectType;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 * Created by s.jensen on 6/23/14.
 */
public class StalenessAnalysis implements UnreachabilityAwareAnalysis<Staleness>  {

    private final Map<Integer, ObjectStaleness> staleness = HashMapFactory.make(256);
    private SourceMap iidMap;
    private List<long[]> functionTrace = new ArrayList<long[]>(1024);

    private final List<Integer> lackingModels = new ArrayList<Integer>();

    private final Deque<SourceLocId> currentCallStack = new ArrayDeque<SourceLocId>();

    private static enum EntryOrExit {
        ENTRY,
        EXIT
    }

    @Override
    public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteIID, Context newContext, long time) {
        functionTrace.add(new long[] {EntryOrExit.ENTRY.ordinal(), time, slId.getSourceFileId(), slId.getIid()});
        currentCallStack.push(callSiteIID);
    }

    @Override
    public void functionExit(SourceLocId slId, Context functionContext, Set<String> unReferenced, long time) {
        functionTrace.add(new long[] {EntryOrExit.EXIT.ordinal(), time, slId.getSourceFileId(), slId.getIid()});
        currentCallStack.pop();
    }

    @Override
    public void init(Timer t, SourceMap iidMap) {
        this.iidMap = iidMap;
    }

    @Override
    public void create(SourceLocId slId, int objectId, long time, boolean isDom) {
        if (objectId != ContextProvider.GLOBAL_OBJECT_ID) {
            insert(slId, objectId, time, callStackAsList(), isDom ? ObjectStaleness.ObjectType.DOM : ObjectStaleness.ObjectType.OBJECT);
        }
    }

    private void insert(SourceLocId slId, int objectId, long time, List<SourceLocId> callStack, ObjectStaleness.ObjectType type) {
        assert !staleness.containsKey(objectId);
        staleness.put(objectId, new ObjectStaleness(slId, objectId, time, callStack, type));
    }

    private List<SourceLocId> callStackAsList() {
    	return new ArrayList<SourceLocId>(currentCallStack);
    }

    @Override
    public void createFun(SourceLocId slId, int objectId, int prototypeId, SourceLocId functionEnterIID, Set<String> namesReferencedByClosures, Context context, long time) {

        insert(slId, objectId, time, callStackAsList(), ObjectStaleness.ObjectType.FUNCTION);
        insert(slId,prototypeId, time, callStackAsList(), ObjectStaleness.ObjectType.PROTOTYPE);
    }

    @Override
    public void unreachableObject(final SourceLocId slId, final int objectId, final long time, final int shallowSize) {
        ObjectStaleness i = staleness.get(objectId);
        assert i != null;
        i.unreachableTime = time;
        i.unreachableSite = slId;
		if (domParent2Children.containsKey(objectId)) {
			// still in the live DOM, so treat this point as its last use time
			i.lastUseTime = time;
			i.lastUseSite = slId;
			domParent2Children.remove(objectId);
		}
        long staleness = time - (i.lastUseTime == ObjectStaleness.DEFAULT_VAL ? i.creationTime : i.lastUseTime);
        if (staleness < 0) { // Use last use time/site as better approximation of unreachability.
            staleness = 0;
            i.unreachableSite = SourceMap.UNKNOWN_ID;
            i.unreachableTime = i.lastUseTime;
            if (System.getProperty("testing", "").equals("yes")) {
                lackingModels.add(objectId);
            }
        }
        assert staleness >= 0;
        i.staleness = staleness;
        i.shallowSize = shallowSize + 1;
    }

    @Override
    public void unreachableContext(SourceLocId slId, Context ctx, long time) {
        //Dont track contexts.
    }

    @Override
    public void lastUse(int objectId, SourceLocId slId, long time) {
        if (objectId == ContextProvider.GLOBAL_OBJECT_ID) return;
        ObjectStaleness i = staleness.get(objectId);
        assert i != null : String.format("No create: sourceLoc : %s objectId : %d time : %d", iidMap.get(slId).toString(), objectId, time);
        // for DOM nodes, we may have already marked a last use at some later time point
        // when the node was removed from the visible DOM.  so, check here that we are
        // not making the last use time earlier before updating it
        if (i.type != ObjectType.DOM || time > i.lastUseTime) {
            i.lastUseTime = time;
            i.lastUseSite = slId;
            if (i.unreachableTime != ObjectStaleness.DEFAULT_VAL) {
                //We already saw the unreachability time for this object so we recompute staleness
            	if (i.unreachableTime > i.lastUseTime) {
                    i.staleness = i.unreachableTime - i.lastUseTime;
            	} else {
            		// our unreachability time was bogus (e.g., due to uninstrumented code).
            		// just set staleness to 0
            		i.unreachableTime = i.lastUseTime;
            		i.unreachableSite = SourceMap.UNKNOWN_ID;
            		i.staleness = 0;
            	}
                assert i.staleness >= 0 : i.toMap(iidMap, true, true).toString() + " IID " + i.slID;
            }
        }
    }

    @Override
    public Staleness endExecution(final long time) {
        if (System.getProperty("testing","").equals("yes") && !lackingModels.isEmpty()) {
            System.out.println("The following objects had lastUse occur AFTER unreachability");
            Collections.sort(lackingModels);
            for (Integer i : lackingModels) {
                System.out.println(i);
            }
        }
        Collection<ObjectStaleness> values = staleness.values();
        Map<SourceLocId,List<ObjectStaleness>> info = HashMapFactory.make();
        for (ObjectStaleness o : values) {
            List<ObjectStaleness> l = MapUtil.findOrCreateList(info, o.slID);
            l.add(o);
        }
        return new Staleness(info, this.functionTrace, iidMap, System.getProperty("verbosecallstack","").equals("yes"));
    }

    /**
     * keep track of DOM tree, since nodes in the tree should not be marked as stale
     */
    private final Map<Integer,Set<Integer>> domParent2Children = HashMapFactory.make();

	@Override
	public void domRoot(int nodeId) {
		domParent2Children.put(nodeId, HashSetFactory.<Integer>make());
	}

	@Override
	public void addDOMChild(int parentId, int childId, long time) {
		Set<Integer> children = domParent2Children.get(parentId);
		if (children != null) { // in the tree
			children.add(childId);
			if (!domParent2Children.containsKey(childId)) {
				domParent2Children.put(childId, HashSetFactory.<Integer>make());
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
				ObjectStaleness objectStaleness = staleness.get(curNode);
				objectStaleness.lastUseTime = time;
				objectStaleness.lastUseSite = SourceMap.REMOVE_FROM_DOM_SITE;
				Set<Integer> curChildren = domParent2Children.get(curNode);
				assert curChildren != null;
				worklist.addAll(curChildren);
				domParent2Children.remove(curNode);

			}
		}
	}

    @Override
    public void putField(SourceLocId slId, int baseId, String offset, int objectId) {

    }

    @Override
    public void write(SourceLocId slId, String name, int objectId) {

    }

    @Override
    public void declare(SourceLocId slId, String name, int objectId) {

    }

    @Override
    public void updateIID(int objId, SourceLocId newIID) {
    	ObjectStaleness extantStaleness = staleness.get(objId);
    	assert extantStaleness != null;
    	staleness.put(objId, extantStaleness.updateIID(newIID, callStackAsList()));
    }

    @Override
    public void returnStmt(int objId) {

    }

    @Override
    public void debug(SourceLocId slId, int oid) {

    }

	@Override
	public void scriptEnter(SourceLocId slId, String filename) {
	}

	@Override
	public void scriptExit(SourceLocId slId) {
	}

    @Override
    public void topLevelFlush(SourceLocId slId) {
    }

    @Override
    public void addToChildSet(SourceLocId slId, int parentId, String name, int childId) {
    }

    @Override
    public void removeFromChildSet(SourceLocId slId, int parentId, String name, int childId) {
    }

    @Override
    public void endLastUse() {
        // TODO handle this case

    }

}
