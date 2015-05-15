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
package com.samsung.memoryanalysis.referencecounter.heap;


import java.io.Writer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import com.ibm.wala.util.collections.HashMapFactory;
import com.ibm.wala.util.collections.HashSetFactory;
import com.ibm.wala.util.functions.VoidFunction;
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.context.ContextProvider;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 * Created by s.jensen on 6/10/14.
 */
public abstract class ReferenceCountedHeapGraph {

    private static final String DOM_CHILD_EDGE_NAME = "~dom-child~";
    public static final String PARENT_CONTEXT_FIELD = "~PARENT-CONTEXT~";
    private final Deque<Set<ContextOrObjectId>> candidates = new ArrayDeque<Set<ContextOrObjectId>>();
    private final Map<ContextOrObjectId, SourceLocIdAndTime> cycleQueue = HashMapFactory.make();
    private final Set<ContextOrObjectId> markSet = HashSetFactory.make();
    protected VoidFunction<Unreachability> unreachableCallback;
    private int cycleQueueLimit = 50000;
    private Timer timer = null;

    private class ParentContextAndFunId {
    	public String parentContext;
    	public int funId;

    	public ParentContextAndFunId(String parentContext, int funId) {
    		this.parentContext = parentContext;
    		this.funId = funId;
    	}

		@Override
		public String toString() {
			return "(" + parentContext + "," + funId + ")";
		}


    }

    private final Map<Long, ParentContextAndFunId> resurrectedContexts = HashMapFactory.make();


    public ReferenceCountedHeapGraph() {

        this.unreachableCallback = new VoidFunction<Unreachability>() {
            @Override
            public void apply(Unreachability v) {
            }
        };
    }

    public void setCycleQueueLimit(int cycleQueueLimit) {
        this.cycleQueueLimit = cycleQueueLimit;
    }

    public void setTimer(Timer timer) {
        this.timer = timer;
    }

    public abstract void newNode(ContextOrObjectId o);

    protected abstract void addEdge(NamedEdge edge, ContextOrObjectId to);

    protected abstract void addNamedMultiEdge(NamedMultiEdge edge);

    protected abstract void removeEdge(HeapEdge edge);

    protected abstract void removeNode(ContextOrObjectId node);

    protected abstract Iterator<ContextOrObjectId> bfsIterator(ContextOrObjectId start);

    protected abstract Iterator<ContextOrObjectId> bfsIterator();

    public abstract Set<HeapEdge> getOutEdges(ContextOrObjectId node);

    public abstract Set<NamedEdge> getNamedOutEdges(ContextOrObjectId node);

    public abstract ContextOrObjectId getTarget(HeapEdge edge);

    protected abstract int referenceCount(ContextOrObjectId node);

    public void setUnreachableCallback(VoidFunction<Unreachability> f) {
        this.unreachableCallback = f;
    }

    public void newObject(int objectId) {
        newNode(ContextOrObjectId.make(objectId));
    }

    public void newContext(Context ctx, int funId) {
        Context parentOp = ctx.getParent();
        candidates.push(HashSetFactory.<ContextOrObjectId>make());
        newNode(ContextOrObjectId.make(ctx));
        if (parentOp != null) {
            addParentReference(ctx, parentOp, funId);
        }
    }

    /**
     *
     * @param node
     * @return true if node is in any candidate set.
     */
    protected boolean isCandidate(ContextOrObjectId node) {
        for (Set<ContextOrObjectId> candidateSet : candidates) {
            if (candidateSet.contains(node))
                return true;
        }
        return false;
    }

    private void addParentReference(Context child, Context parent, int funId) {
        ContextOrObjectId childNode = ContextOrObjectId.make(child);
        ContextOrObjectId parentNode = ContextOrObjectId.make(parent);
        if (!containsNode(parentNode)) {
            reMakeContext(parentNode);
            resurrectedContexts.put(timer.currentTime(), new ParentContextAndFunId(parent.toString(), funId));
        }
        NamedEdge newEdge = new NamedEdge(childNode, PARENT_CONTEXT_FIELD);
        addEdge(newEdge, parentNode);
    }

    private void reMakeContext(ContextOrObjectId parentNode) {
        assert parentNode.type == ContextOrObjectId.Type.CONTEXT;
        assert !containsNode(parentNode);
        newNode(parentNode);
        Context iter = parentNode.getContext();
        while (!iter.isGlobal()) {
            ContextOrObjectId iterNode = ContextOrObjectId.make(iter);
            Context parent = iter.getParent();// Safe, since we know iter is not global;
            ContextOrObjectId pn = ContextOrObjectId.make(parent);
            boolean stop = true;
            if (!containsNode(pn)) {
                newNode(pn);
                stop = false;
            }
            NamedEdge newEdge = new NamedEdge(iterNode, PARENT_CONTEXT_FIELD);
            addEdge(newEdge, pn);
            if (stop)
                break;
            iter = parent;
        }
    }

    public void addObjectReference(int fromId, String name, int toId, SourceLocId slId) {
        ContextOrObjectId from = ContextOrObjectId.make(fromId);
        if (!containsNode(from))
            newNode(from);
        ContextOrObjectId to = ContextOrObjectId.make(toId);
        if (!containsNode(to))
            newNode(to);
        NamedEdge e = new NamedEdge(from, name);
        ContextOrObjectId old = getTarget(e);
        if (old != null) {
            decrementReference(e, old, slId);//removeEdge(e, old);
        }
        if (!isNull(toId))
            addEdge(e, to);
    }

    /**
     * Remove the given edge and handle potential garbage cycles.
     *
     * @param e
     * @param recv
     */
    private void decrementReference(HeapEdge e, ContextOrObjectId recv, SourceLocId slId) {
        removeEdge(e);
        if (referenceCount(recv) > 0) {
            addToCycleQueue(recv, slId);
        } else if (referenceCount(recv) == 0) {
            addToFlushQueue(recv);//;candidates.add(to);
        }
    }

    private void addToCycleQueue(ContextOrObjectId o, SourceLocId slId) {
        SourceLocIdAndTime r = cycleQueue.get(o);
        if (r == null) {
            r = new SourceLocIdAndTime(slId, timer.currentTime());
            cycleQueue.put(o, r);
        } else {
            r.time = timer.currentTime();
            r.slId = slId;
        }
    }

    private void markReachable(final List<ContextOrObjectId> roots) {
        final Deque<ContextOrObjectId> wl = new ArrayDeque<ContextOrObjectId>();
        for (ContextOrObjectId start : roots) {
            assert containsNode(start);
            wl.add(start);
            while (!wl.isEmpty()) {
                ContextOrObjectId node = wl.pop();
                if (markSet.contains(node))
                    continue;
                markSet.add(node);
                for (HeapEdge edge: getOutEdges(node)) {
                    ContextOrObjectId target = getTarget(edge);
                    if (target != null) {
                        wl.add(target);
                    }
                }
            }
            wl.clear();
        }
    }

    public static enum FlushType {
        REGULAR,
        FORCE,
        END_EXECUTION
    }

    public void flushCycleQueue(Set<Integer> dontFlush, FlushType flushType, Collection<Context> liveContext) {
        //1. Remove elements with ref count = 0
        Iterator<ContextOrObjectId> iter = cycleQueue.keySet().iterator();
        while (iter.hasNext()) {
            final ContextOrObjectId c = iter.next();
            if (c.type == ContextOrObjectId.Type.CONTEXT && c.getContext().isLive())
                iter.remove();
            if (referenceCount(c) == 0)
                iter.remove(); //Reflected onto the underlying Map.
        }
        if (cycleQueue.size() < cycleQueueLimit && flushType == FlushType.REGULAR)
            return;
        List<Map.Entry<ContextOrObjectId, SourceLocIdAndTime>> realQueue = new ArrayList<Map.Entry<ContextOrObjectId, SourceLocIdAndTime>>(cycleQueue.entrySet());

        //2. Sort the remaining elements by insertion time in descending order
        Collections.sort(realQueue, new Comparator<Map.Entry<ContextOrObjectId, SourceLocIdAndTime>>() {

            @Override
            public int compare(Entry<ContextOrObjectId, SourceLocIdAndTime> a,
                    Entry<ContextOrObjectId, SourceLocIdAndTime> b) {
                return (int) (b.getValue().time - a.getValue().time);
            }
        });
        if (flushType != FlushType.END_EXECUTION) { //Nothing gets marked at end of execution.
            List<ContextOrObjectId> roots = new ArrayList<ContextOrObjectId>(liveContext.size());
            for (Context c : liveContext) {
                roots.add(ContextOrObjectId.make(c));
            }
            markReachable(roots);
        }
        for (Map.Entry<ContextOrObjectId, SourceLocIdAndTime> root : realQueue) {
            ContextOrObjectId node = root.getKey();
            SourceLocIdAndTime insertionInfo = root.getValue();
            if (markSet.contains(node))
                continue;
            collectUnmarked(node, insertionInfo);
        }

        markSet.clear();
        cycleQueue.clear();
    }

    private void collectUnmarked(ContextOrObjectId startNode, SourceLocIdAndTime startTime) {
        final Deque<ContextOrObjectId> wl = new ArrayDeque<ContextOrObjectId>();
        wl.push(startNode);
        while (!wl.isEmpty()) {
            ContextOrObjectId current = wl.pop();
            SourceLocIdAndTime g = cycleQueue.get(current);
            long time = startTime.time;
            SourceLocId slId = startTime.slId;
            if (g != null) {
                time = Math.max(startTime.time, g.time);
                slId = time == g.time ? g.slId : startTime.slId;
            }
            if (current.type == ContextOrObjectId.Type.ID) {
                unreachableCallback.apply(new Unreachability(current.getId(), slId, time));
            }
            markSet.add(current);
            for (HeapEdge edge: getOutEdges(current)) {
                ContextOrObjectId target = getTarget(edge);
                if (target != null) {
                    if (!markSet.contains(target)) {
                        wl.push(target);
                    }
                }
            }
            removeNode(current);
        }
    }


    public abstract boolean containsNode(ContextOrObjectId v);

    public abstract Set<HeapEdge> incoming(ContextOrObjectId c);

    public boolean isNull(int id) {
        return id == 0;
    }

    public boolean isGlobalObject(int id) {
        return id == ContextProvider.GLOBAL_OBJECT_ID;
    }

    public void addContextReference(Context ctx, String name, int toId, SourceLocId slId) {
        ContextOrObjectId from = ContextOrObjectId.make(ctx);
        if (!containsNode(from))
            newNode(from);
        ContextOrObjectId to = ContextOrObjectId.make(toId);
        if (!containsNode(to))
            newNode(to);
        NamedEdge e = new NamedEdge(from, name);
        ContextOrObjectId target = getTarget(e);
        if (target != null) {
            decrementReference(e, target, slId);
        }
        if (!isNull(toId))
            addEdge(e, to);
    }

    public int referenceCount(int objectId) {
        return referenceCount(ContextOrObjectId.make(objectId));
    }

    public int referenceCount(Context c) {
        return referenceCount(ContextOrObjectId.make(c));
    }

    public void flush(SourceLocId slId, final Set<Integer> dontFlush, Collection<Context> live) {
        Set<ContextOrObjectId> c = candidates.peek();
        flushForContext(slId, dontFlush, live, c);
    }

    private void flushForContext(SourceLocId slId,
            final Set<Integer> dontFlush, Collection<Context> live,
            Set<ContextOrObjectId> c) {
        Iterator<ContextOrObjectId> i = c.iterator();
        while (i.hasNext()) {
            ContextOrObjectId e = i.next();
            i.remove();
            if (e.type == ContextOrObjectId.Type.CONTEXT && e.getContext().isLive() || isCandidate(e)) {
                continue;
            }
            if (e.type == ContextOrObjectId.Type.ID && dontFlush.contains(e.getId())) {

                continue;
            }
            if (referenceCount(e) == 0)
                decrementReachable(slId, e);
            else {
                addToCycleQueue(e, slId);
            }
        }
        if (cycleQueue.size() > cycleQueueLimit && !noCycleCollection) {
            flushCycleQueue(dontFlush, FlushType.REGULAR, live);
        }
    }

    private Set<ContextOrObjectId> decrementReachable(SourceLocId slId, ContextOrObjectId o) {
        assert referenceCount(o) == 0;
        final Set<ContextOrObjectId> res = HashSetFactory.make();
        final Deque<ContextOrObjectId> stack = new ArrayDeque<ContextOrObjectId>();
        stack.push(o);
        while (!stack.isEmpty()) {
            ContextOrObjectId s = stack.pop();
            if (isCandidate(s))
                continue;
            if (s.getContext() != null) {
                if (s.getContext().isLive()) { //A live context never becomes unreachable.
                    continue;
                }
            }
            if (referenceCount(s) == 0) {
                int id = s.getId();
                if (id != -1) {
                    unreachableCallback.apply(new Unreachability(id, slId, timer.currentTime()));
                }
                for (HeapEdge succ: getOutEdges(s)) {
                    ContextOrObjectId target = getTarget(succ);
                    if (target != null) {
                        stack.push(target);
                    }
                }
                removeNode(s);
            } else {
                addToCycleQueue(s, slId);
            }
        }
        return res;
    }

    public void addClosureReference(int funId, Context context) {
        ContextOrObjectId func = ContextOrObjectId.make(funId);
        ContextOrObjectId ctx = ContextOrObjectId.make(context);
        addEdge(new NamedEdge(func, "_CONTEXT_"), ctx);
    }

    public void contextSealed(Context functionContext, final Set<String> unReferenced, SourceLocId slId) {
        ContextOrObjectId c = ContextOrObjectId.make(functionContext);
        Set<NamedEdge> namedOut = getNamedOutEdges(c);
        Set<NamedEdge> toDelete = HashSetFactory.make();
        for (NamedEdge e: namedOut) {
            if (unReferenced.contains(e.getName())) {
                toDelete.add(e);
            }
        }
        for (NamedEdge e : toDelete) {
            ContextOrObjectId to = getTarget(e);
            if (to != null) {
                decrementReference(e, to, slId);
                removeEdge(e);
            }
        }
        if (referenceCount(c) == 0)
            addToFlushQueue(c);//candidates.add(c);
        else {
            addToCycleQueue(c, slId);
        }

    }

    public void handleValue(int objectId) {
        if (referenceCount(objectId) == 0) {
            addObjectIdToCandidates(candidates.peek(), ContextOrObjectId.make(objectId), objectId);
        }
    }

    private void addObjectIdToCandidates(Set<ContextOrObjectId> curCandidates, ContextOrObjectId c, int id) {
        if (!isNull(id) && !isGlobalObject(id)) {
            curCandidates.add(c);
        }
    }

    public void addToFlushQueue(final ContextOrObjectId c) {
        Integer id = c.getId();
        if (id != null) {
            addObjectIdToCandidates(candidates.peek(), c, id);
        }
        Context cc = c.getContext();
        if (cc != null) {
            candidates.peek().add(c);
        }
    }

    public abstract void toDot(Writer w);

    public void functionExit(Set<Integer> returnValues) {
        candidates.pop();
        Set<ContextOrObjectId> s = candidates.peek();
        if (candidates.size() > 0) {
            for (Integer i: returnValues) {
                addObjectIdToCandidates(s, ContextOrObjectId.make(i), i);
            }
        }
        returnValues.clear();
    }

    private boolean noCycleCollection = false;

    public void endFlush(SourceLocId slId, Set<Integer> returnValues, Collection<Context> liveContexts) {
        noCycleCollection = true;
        // in nearly all cases, candidates will have exactly one set,
        // corresponding to the global scope.  However, in rare cases,
        // (e.g., when a node program calls process.exit()), the program
        // can exit in a way that doesn't clean up all the extant call stacks,
        // in which case there will be multiple candidates sets.  To be safe,
        // we clear out all candidates here
        while (candidates.size() > 0) {
            Set<ContextOrObjectId> c = candidates.pop();
            flushForContext(slId, returnValues, liveContexts, c);
        }
        flushCycleQueue(returnValues, FlushType.END_EXECUTION, liveContexts);
        //Remove the "null" element
        removeNode(ContextOrObjectId.make(0));
        if (System.getProperty("testing","").equals("yes") && !resurrectedContexts.isEmpty()) {
            System.out.println("The following contexts were re-added during execution");
            System.out.printf("Time   toString\n");
            for (Map.Entry<Long, ParentContextAndFunId> e : resurrectedContexts.entrySet()) {
                System.out.printf("%-6d %s\n", e.getKey(), e.getValue());
            }
        }

    }

    public abstract Set<ContextOrObjectId> getAllNodes();

    public boolean checkEmpty() {
        Set<ContextOrObjectId> nodes = getAllNodes();
        if (nodes.isEmpty())
            return true;
        System.out.println("Heap not empty: remaining objects");
        for (ContextOrObjectId n : nodes) {
            System.out.println(n);
        }
        return false;
    }

    public void addDOMChildReference(int parentId, int childId) {
        assert !isNull(parentId);
        assert !isNull(childId);
        addToChildSet(ContextOrObjectId.make(parentId), DOM_CHILD_EDGE_NAME, ContextOrObjectId.make(childId));
    }

    public void addToChildSet(ContextOrObjectId parent, String name, ContextOrObjectId child) {
        if (!containsNode(parent))
            newNode(parent);
        if (!containsNode(child))
            newNode(child);
        NamedMultiEdge e = new NamedMultiEdge(parent, name, child);
        addNamedMultiEdge(e);
    }

    public void removeFromChildSet(ContextOrObjectId parent, String name, ContextOrObjectId child, SourceLocId slId) {
        assert containsNode(parent) && containsNode(child);
        NamedMultiEdge e = new NamedMultiEdge(parent, name, child);
        decrementReference(e, child, slId);
    }

    public void removeDOMChildReference(int parentId, int childId) {
        assert !isNull(parentId);
        assert !isNull(childId);
        removeFromChildSet(ContextOrObjectId.make(parentId), DOM_CHILD_EDGE_NAME, ContextOrObjectId.make(childId), SourceMap.UNKNOWN_ID);
    }

    public int getOutDegree(int objId) {
        ContextOrObjectId obj = ContextOrObjectId.make(objId);
        return getOutDegree(obj);
    }

    protected abstract int getOutDegree(ContextOrObjectId obj);

    /**
     * Belongs to the cycle collector
     */
    @SuppressWarnings("unused")
	private enum NodeColor {
        GREEN,
        RED,
        BLUE
    }

    private class SourceLocIdAndTime {
        public SourceLocId slId;
        public long time;

        public SourceLocIdAndTime(SourceLocId slId, long time) {
            this.slId = slId;
            this.time = time;
        }

        @Override
        public String toString() {
            return String.format("(%s,%d)", slId, time);
        }
    }


}
