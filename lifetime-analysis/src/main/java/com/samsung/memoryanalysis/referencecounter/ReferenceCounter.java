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

import static com.samsung.memoryanalysis.util.Util.makeRelative;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.ibm.wala.util.collections.HashMapFactory;
import com.ibm.wala.util.collections.HashSetFactory;
import com.ibm.wala.util.functions.VoidFunction;
import com.samsung.memoryanalysis.context.Context;
import com.samsung.memoryanalysis.context.ContextAwareAnalysis;
import com.samsung.memoryanalysis.context.ContextListener;
import com.samsung.memoryanalysis.context.ContextProvider;
import com.samsung.memoryanalysis.options.MemoryAnalysisOptions;
import com.samsung.memoryanalysis.referencecounter.AccessPath.AccessPathElement;
import com.samsung.memoryanalysis.referencecounter.heap.ContextOrObjectId;
import com.samsung.memoryanalysis.referencecounter.heap.HeapEdge;
import com.samsung.memoryanalysis.referencecounter.heap.ReferenceCountedHeapGraph;
import com.samsung.memoryanalysis.referencecounter.heap.Unreachability;
import com.samsung.memoryanalysis.traceparser.SourceMap;
import com.samsung.memoryanalysis.traceparser.SourceLocation;
import com.samsung.memoryanalysis.traceparser.SourceMap.SourceLocId;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 *
 * Created by s.jensen on 6/10/14.
 */
public class ReferenceCounter<T> implements ContextAwareAnalysis<T> {

    private final ReferenceCountedHeapGraph graph;
    private final MemoryAnalysisOptions options;
    private Timer timer;

    private  SourceMap iidMap;

    private final Set<Integer> returnValues = HashSetFactory.make();

    private final Set<Integer> ignoredObjects = HashSetFactory.make();

    // objId -> Allocation sites.
    private final Map<Integer, SourceLocation> allocationSites = HashMapFactory.make();
    private final Map<Integer,String> endOutput = HashMapFactory.make();

    private final UnreachabilityAwareAnalysis<T> client;
    private final Set<Integer> domNodes = HashSetFactory.make();
    private ContextListener contextInfo;
    public Map<Integer, Set<AccessPath>> accessPaths = HashMapFactory.make();


    public ReferenceCounter(ReferenceCountedHeapGraph e, UnreachabilityAwareAnalysis<T> client, final MemoryAnalysisOptions o) {
        this.graph = e;
        this.options = o;
        this.client = client != null ? client : new DummyUnreachabilityAnalysis<T>();
        e.setUnreachableCallback(new VoidFunction<Unreachability>() {

            @Override
            public void apply(Unreachability f) {
                if (ignoredObjects.contains(f.objId))
                    return;
                ReferenceCounter.this.client.unreachableObject(f.slId, f.objId, f.time, graph.getOutDegree(f.objId));
                if (isRCVerbose()) {
                    SourceLocation allocSourceLoc = allocationSites.get(f.objId);
                    assert allocSourceLoc != null : "no allocation site map entry for " + f.objId;
                    endOutput.put(f.objId, String.format("Id: %-5d Alloc: %-40s Time: %-10d Loc: %s", f.objId, makeRelative(allocSourceLoc), f.time,
                            makeRelative(iidMap.get(f.slId))));
                }

            }
        });
        int cycleQueueLimit = o.getCycleQueuelimit();
        if (cycleQueueLimit != -1) {
            e.setCycleQueueLimit(cycleQueueLimit);
        }
    }

    public ReferenceCounter(ReferenceCountedHeapGraph e, UnreachabilityAwareAnalysis<T> client) {
        this(e, client, new MemoryAnalysisOptions());
    }


    @Override
    public void init(final Timer timer, final ContextListener list, SourceMap iidMap) {
        this.timer = timer;
        graph.setTimer(timer);
        this.iidMap = iidMap;
        this.contextInfo = list;
        graph.newContext(list.getGlobal(), 0);
        client.init(timer, iidMap);
        Map<Integer, Integer> map = options.getAccessPathObjects();
        if (map != null) {
            for (Map.Entry<Integer,Integer> e : map.entrySet()) {
                final Integer objectId = e.getKey();
                Integer printAtTime = e.getValue();
                timer.registerAlarm(printAtTime, new VoidFunction<Long>() {
                    @Override
                    public void apply(Long v) {
                        computeAccessPath(objectId);

                    }
                });
            }
        }
    }

    private void computeAccessPath(int objectId) {
        Set<AccessPath> p = new AccessPathComputer(ContextOrObjectId.make(objectId)).run();
        accessPaths.put(objectId,p);
    }

    public class AccessPathComputer {
        private int MAX_AP = 10;
        final ContextOrObjectId node;
        final Set<ContextOrObjectId> visited;
        Set<AccessPath> res = HashSetFactory.make();

        public AccessPathComputer(ContextOrObjectId node) {
            this.node = node;
            this.visited = HashSetFactory.make();
        }

        private void walker(ContextOrObjectId current, Deque<AccessPath.AccessPathElement> path) throws RuntimeException {
            visited.add(current);
            if (isLive(current)) {
                res.add(new AccessPath(getIID(node),new ArrayList<AccessPathElement>(path)));
                if (res.size() > MAX_AP)
                    throw new RuntimeException(); //TODO: Ugly.
            } else {
                Set<HeapEdge> incoming = graph.incoming(current);
                for (HeapEdge edge: incoming) {
                    ContextOrObjectId from = edge.getFrom();
                    if (visited.contains(from))
                        return;
                    String name = edge.getName();
                    AccessPath.AccessPathElement ape = new AccessPath.AccessPathElement(name,getIID(from));
                    path.addFirst(ape);
                    walker(from,path);
                    path.removeFirst();
                }
            }
            visited.remove(current);
        }

        private boolean isLive(ContextOrObjectId node) {
            return node.type == ContextOrObjectId.Type.CONTEXT && node.getContext().isLive();
        }

        public Set<AccessPath> run() {
            try {
                walker(node, new LinkedList<AccessPath.AccessPathElement>());
            } catch (RuntimeException tooManyPaths) {
                return res;
            }
            return res;
        }

    }

    private String getIID(ContextOrObjectId node) {
        switch (node.type) {
            case ID: return allocationSites.get(node.getId()).toString();
            case CONTEXT: return node.getContext().toString();
        }
        throw new IllegalStateException();
    }

    @Override
    public void declare(final SourceLocId slId, final String name, final int objectId, final Context context) {
        if (options.isIgnoreArguments() && name.equals("arguments")) {
            ignoredObjects.add(objectId);
        }

        graph.addContextReference(context, name, objectId, slId);
        graph.handleValue(objectId);
        client.declare(slId, name, objectId);
    }

    @Override
    public void create(final SourceLocId slId, final int objectId) {
        if (objectId != ContextProvider.GLOBAL_OBJECT_ID) {
            graph.newObject(objectId);
            saveAllocationSite(objectId, slId);
            graph.handleValue(objectId);
        }
        client.create(slId, objectId, timer.currentTime(), domNodes.contains(objectId));
    }

    @Override
    public void createFun(final SourceLocId slId, final int objectId, final int prototypeId, final SourceLocId functionEnterIID,
                          final Set<String> namesReferencedByClosures, final Context context) {
        graph.newObject(objectId);
        graph.newObject(prototypeId);
        if (!context.isGlobal())
            graph.addClosureReference(objectId, context);
        graph.addObjectReference(objectId, "prototype", prototypeId, slId);
        saveAllocationSite(objectId, slId);
        saveAllocationSite(prototypeId, slId);
        graph.handleValue(objectId);
        graph.handleValue(prototypeId);
        client.createFun(slId, objectId, prototypeId, functionEnterIID, namesReferencedByClosures, context, timer.currentTime());
    }

    private void saveAllocationSite(final int objectId, final SourceLocId slId) {
        allocationSites.put(objectId, iidMap.get(slId));
     }

    @Override
    public void putField(final SourceLocId slId, final int baseId, final String offset, final int objectId) {
        if (ignoredObjects.contains(baseId)) {
            graph.handleValue(objectId);
            return;
        }
        graph.addObjectReference(baseId, offset, objectId, slId);

        // why do we need this call?  --MS
        graph.handleValue(objectId);
        client.putField(slId, baseId, offset, objectId);
    }

    @Override
    public void write(final SourceLocId slId, final String name, final int objectId, final Context context) {
        graph.addContextReference(context, name, objectId, slId);

        graph.handleValue(objectId);
        client.write(slId, name, objectId);
    }

    @Override
    public void lastUse(final int objectId, SourceLocId slId, int time) {
        client.lastUse(objectId, slId, time);
    }

    @Override
    public void functionEnter(final SourceLocId slId, final int funId, SourceLocId callSiteIID, final Context newContext) {
        graph.newContext(newContext, funId);
        client.functionEnter(slId, funId, callSiteIID, newContext, timer.currentTime());
    }

    @Override
    public void functionExit(final SourceLocId slId, final Context calleeContext, final Context callerContext, final Set<String> unReferenced) {
        graph.contextSealed(calleeContext, unReferenced, slId);
        graph.flush(slId, returnValues, contextInfo.getLiveContexts());
        graph.functionExit(returnValues);
        client.functionExit(slId, calleeContext, unReferenced, timer.currentTime());
    }

    @Override
    public void topLevelFlush(final SourceLocId slId, final Context currentContext) {
        graph.flush(slId, returnValues, contextInfo.getLiveContexts());
        client.topLevelFlush(slId);
    }

    @Override
    public T endExecution(final Context global, Set<String> globalNames) {
        graph.contextSealed(global, globalNames, SourceMap.END_OF_PROGRAM_ID);
        graph.endFlush(SourceMap.END_OF_PROGRAM_ID, returnValues, contextInfo.getLiveContexts());
        if (isTesting()) {
        	graph.checkEmpty();
        }
        if (isRCVerbose()) {
            Collection<String> sortedVals = (new TreeMap<Integer,String>(endOutput)).values();
            for (String s : sortedVals) {
                System.out.println(s);
            }
        }
        accessPathJson();
        return client.endExecution(timer.currentTime());
    }

    private void accessPathJson() {
        if (!accessPaths.isEmpty()) {
            Map<String, Object> json = HashMapFactory.make();
            for (Map.Entry<Integer, Set<AccessPath>> x : accessPaths.entrySet()) {
            	Map<String,Object> pathInfo = HashMapFactory.make();
            	List<Map<String,Object>> l = new ArrayList<Map<String,Object>>();
            	for (AccessPath p : x.getValue()) {
            	    l.add(p.toMap());
            	}
            	pathInfo.put("accessPaths", l);
                json.put(x.getKey().toString(), pathInfo);
            }
            Gson out = new GsonBuilder().setPrettyPrinting().create();
            out.toJson(json, System.out);
        }
    }


    @Override
    public void updateIID(final int objId, SourceLocId newIID) {

        saveAllocationSite(objId,newIID);
        client.updateIID(objId, newIID);
    }


    @Override
    public void debug(final SourceLocId slId, final int oid, Context currentContext) {
    	graph.flushCycleQueue(returnValues, ReferenceCountedHeapGraph.FlushType.FORCE, contextInfo.getLiveContexts());
    	if (isTesting()) {
            System.out.printf("%s : RC(%s) = %d\n", makeRelative(iidMap.get(slId)),
                    makeRelative(allocationSites.get(oid)), graph.referenceCount(oid));
    	}
        client.debug(slId, oid);
    }

    private boolean isTesting() {
        return System.getProperty("testing", "").equals("yes");
    }

    private boolean isRCVerbose() {
        return System.getProperty("rcverbose", "").equals("yes");
    }


    @Override
    public void returnStmt(final int objId) {
        returnValues.add(objId);
        client.returnStmt(objId);
    }

    @Override
    public void createDomNode(SourceLocId slId, int objectId) {
        domNodes.add(objectId);
    	this.create(slId, objectId);
    }

    @Override
    public void addDOMChild(int parentId, int childId) {
        graph.addDOMChildReference(parentId, childId);
        client.addDOMChild(parentId, childId, timer.currentTime());
    }

    @Override
    public void removeDOMChild(int parentId, int childId) {
    	graph.removeDOMChildReference(parentId, childId);
    	client.removeDOMChild(parentId, childId, timer.currentTime());
    }

	@Override
	public void addToChildSet(SourceLocId slId, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
		graph.addToChildSet(parentNode, name, childNode);
		client.addToChildSet(slId, parentNode.getId(), name, childNode.getId());
	}

	@Override
	public void removeFromChildSet(SourceLocId slId, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
		graph.removeFromChildSet(parentNode, name, childNode, slId);
		client.removeFromChildSet(slId, parentNode.getId(), name, childNode.getId());
	}

	@Override
	public void domRoot(int nodeId) {
		client.domRoot(nodeId);
	}

	@Override
	public void scriptEnter(SourceLocId slId, String filename) {

		this.client.scriptEnter(slId, filename);
	}

	@Override
	public void scriptExit(SourceLocId slId) {
		this.client.scriptExit(slId);
	}

}
