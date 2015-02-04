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

import java.io.OutputStream;
import java.io.PrintStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.google.gson.Gson;
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
 * @author m.sridharan
 *
 */
public class StreamingStalenessAnalysis implements
		UnreachabilityAwareAnalysis<Void> {

	static final int UNKNOWN = -20, REMOVE_FROM_DOM_SITE = -50;
	/**
	 * staleness information for an individual object
	 * @author m.sridharan
	 *
	 */
	class ObjInfo {

		final int objId;
		final ObjectType type;
		SourceLocId allocationIID;
		final long creationTime;
		List<SourceLocId> creationCallStack;

		long mostRecentUseTime = UNKNOWN;
		SourceLocId mostRecentUseSite = SourceMap.UNKNOWN_ID;
		long unreachableTime = UNKNOWN;
		SourceLocId unreachableSite = SourceMap.UNKNOWN_ID;

		/**
		 * does this record correspond to a "revived" object,
		 * i.e., an object for which we already flushed a
		 * (bogus) record due to uninstrumented / native code?
		 */
		boolean revived = false;

		public ObjInfo(int objId, ObjectType type, SourceLocId allocationIID,
				long creationTime, List<SourceLocId> creationCallStack) {
			this.objId = objId;
			this.type = type;
			this.allocationIID = allocationIID;
			this.creationTime = creationTime;
			this.creationCallStack = creationCallStack;
		}

		public String toJSON() {
			// FORMAT
			// if not revived,
			// [objId, false, type, allocationIID, creationTime, creationStack,
			//   lastUseTime, lastUseSite, unreachableTime, unreachableSite]
			// if revived,
            // [objId, true, type, allocationIID, creationTime, creationStack,
            //   lastUseTime, lastUseSite, unreachableTime, unreachableSite]
            Object[] entry = new Object[] { objId, revived, type.toString(),
                    allocationIID, creationTime, creationCallStack,
                    mostRecentUseTime, mostRecentUseSite, unreachableTime,
                    unreachableSite };
			return gson.toJson(entry);
		}

	}

	private final Map<Integer,ObjInfo> live = HashMapFactory.make();

	/**
	 * unreachable objects for which we have yet to flush a record
	 */
	private final Map<Integer,ObjInfo> unreachable = HashMapFactory.make();

	private final PrintStream out;

    @SuppressWarnings("unused")
	private SourceMap sourceMap;

    private Gson gson = new Gson();

    private final Deque<SourceLocId> currentCallStack = new ArrayDeque<SourceLocId>();

    private List<SourceLocId> callStackAsList() {
    	return new ArrayList<SourceLocId>(currentCallStack);
    }

	public StreamingStalenessAnalysis(OutputStream out) {
		this.out = new PrintStream(out);
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
			this.live.put(
				objectId,
				new ObjInfo(
					objectId,
					isDom ? ObjectStaleness.ObjectType.DOM : ObjectStaleness.ObjectType.OBJECT,
					slId, time, callStackAsList()));
		}
	}

	@Override
	public void createFun(SourceLocId slId, int objectId, int prototypeId,
			SourceLocId functionEnterIID, Set<String> namesReferencedByClosures,
			Context context, long time) {
		List<SourceLocId> callstack = callStackAsList();
		this.live.put(objectId, new ObjInfo(objectId, ObjectType.FUNCTION, slId, time, callstack));
		this.live.put(prototypeId, new ObjInfo(prototypeId, ObjectType.PROTOTYPE, slId, time, callstack));
	}

	@Override
	public void putField(SourceLocId slId, int baseId, String offset, int objectId) {
		// do nothing
	}

	@Override
	public void write(SourceLocId slId, String name, int objectId) {
		// do nothing
	}

	@Override
	public void lastUse(int objectId, SourceLocId slId, long time) {
        if (objectId == ContextProvider.GLOBAL_OBJECT_ID) return;
        ObjInfo objInfo = null;
        if (live.containsKey(objectId)) {
        	objInfo = live.get(objectId);
        } else if (unreachable.containsKey(objectId)) {
        	objInfo = unreachable.get(objectId);
        } else {
        	// revived object!
        	objInfo = new ObjInfo(objectId, ObjectType.OBJECT, SourceMap.UNKNOWN_ID, UNKNOWN, null);
        	objInfo.revived = true;
        	// mark it as live
        	live.put(objectId, objInfo);
        }
        objInfo.mostRecentUseTime = time;
        objInfo.mostRecentUseSite = slId;
	}

	@Override
	public void functionEnter(SourceLocId slId, int funId, SourceLocId callSiteIID,
			Context newContext, long time) {
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
		ObjInfo objInfo = live.get(objId);
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
     * keep track of DOM tree, since nodes in the tree should not be marked as stale
     */
    private final Map<Integer,Set<Integer>> domParent2Children = HashMapFactory.make();

	@Override
	public void addDOMChild(int parentId, int childId, long time) {
		Set<Integer> children = domParent2Children.get(parentId);
		if (children != null) { // in the tree
			children.add(childId);
			if (!domParent2Children.containsKey(childId)) {
				domParent2Children.put(childId, HashSetFactory.<Integer>make());
			}
			// we also know that the DOM child is live.  if it is not
			// recorded as such, add a revived record for it
			if (!live.containsKey(childId)) {
	            ObjInfo objInfo = new ObjInfo(childId, ObjectType.DOM, SourceMap.UNKNOWN_ID, UNKNOWN, null);
	            objInfo.revived = true;
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
				ObjInfo objInfo = live.get(curNode);
				assert objInfo != null;
				objInfo.mostRecentUseTime = time;
				objInfo.mostRecentUseSite = SourceMap.REMOVE_FROM_DOM_SITE;
				Set<Integer> curChildren = domParent2Children.get(curNode);
				assert curChildren != null;
				worklist.addAll(curChildren);
				domParent2Children.remove(curNode);
			}
		}
	}

	@Override
	public void addToChildSet(SourceLocId slId, int parentId, String name, int childId) {
		// do nothing
	}

	@Override
	public void removeFromChildSet(SourceLocId slId, int parentId, String name,
			int childId) {
		// do nothing
	}

	@Override
	public void domRoot(int nodeId) {
		domParent2Children.put(nodeId, HashSetFactory.<Integer>make());
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
        ObjInfo objInfo = null;
        if (live.containsKey(objectId)) {
            objInfo = live.get(objectId);
            live.remove(objectId);
        } else if (unreachable.containsKey(objectId)) {
            // it's a revived object, but we didn't flush the unreachable record yet
            objInfo = unreachable.get(objectId);
            objInfo.revived = true;
        } else {
            // this can happen in rare cases, e.g., for the document object
            objInfo = new ObjInfo(objectId, ObjectType.DOM, SourceMap.UNKNOWN_ID, UNKNOWN, null);
            objInfo.revived = true;
        }
        objInfo.unreachableTime = time;
        objInfo.unreachableSite = slId;
        unreachable.put(objectId, objInfo);
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
	    for (ObjInfo objInfo: unreachable.values()) {
	        this.writeObjEntry(objInfo);
	    }
		unreachable.clear();
	}

	private void writeObjEntry(ObjInfo objInfo) {
		out.println(objInfo.toJSON());
	}

	@Override
	public Void endExecution(long time) {
		assert live.isEmpty();
		flushUnreachable();
		return null;
	}

}
