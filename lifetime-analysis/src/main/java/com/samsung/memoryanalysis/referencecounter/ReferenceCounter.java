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
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.traceparser.SourceLocation;
import com.samsung.memoryanalysis.traceparser.Timer;

/**
 *
 * Created by s.jensen on 6/10/14.
 */
public class ReferenceCounter<T> implements ContextAwareAnalysis<T> {

    private final ReferenceCountedHeapGraph graph;
    private final MemoryAnalysisOptions options;
    private Timer timer;

    private  IIDMap iidMap;

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
                ReferenceCounter.this.client.unreachableObject(f.iid, f.objId, f.time, graph.getOutDegree(f.objId));
                if (isRCVerbose()) {
                    SourceLocation allocSourceLoc = allocationSites.get(f.objId);
                    assert allocSourceLoc != null : "no allocation site map entry for " + f.objId;
                    endOutput.put(f.objId, String.format("Id: %-5d Alloc: %-40s Time: %-10d Loc: %s", f.objId, makeRelative(allocSourceLoc), f.time,
                            makeRelative(iidMap.get(f.iid))));
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
    public void init(final Timer timer, final ContextListener list, IIDMap iidMap) {
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
    public void declare(final int iid, final String name, final int objectId, final Context context) {
        if (options.isIgnoreArguments() && name.equals("arguments")) {
            ignoredObjects.add(objectId);
        }

        graph.addContextReference(context, name, objectId, iid);
        graph.handleValue(objectId);
        client.declare(iid, name, objectId);
    }

    @Override
    public void create(final int iid, final int objectId) {
        if (objectId != ContextProvider.GLOBAL_OBJECT_ID) {
            graph.newObject(objectId);
            saveAllocationSite(objectId, iid);
            graph.handleValue(objectId);
        }
        client.create(iid, objectId, timer.currentTime(), domNodes.contains(objectId));
    }

    @Override
    public void createFun(final int iid, final int objectId, final int prototypeId, final int functionEnterIID,
                          final Set<String> namesReferencedByClosures, final Context context) {
        graph.newObject(objectId);
        graph.newObject(prototypeId);
        if (!context.isGlobal())
            graph.addClosureReference(objectId, context);
        graph.addObjectReference(objectId, "prototype", prototypeId, iid);
        saveAllocationSite(objectId, iid);
        saveAllocationSite(prototypeId, iid);
        graph.handleValue(objectId);
        graph.handleValue(prototypeId);
        client.createFun(iid, objectId, prototypeId, functionEnterIID, namesReferencedByClosures, context, timer.currentTime());
    }

    private void saveAllocationSite(final int objectId, final int iid) {
        allocationSites.put(objectId, iidMap.get(iid));
     }

    @Override
    public void putField(final int iid, final int baseId, final String offset, final int objectId) {
        if (ignoredObjects.contains(baseId)) {
            graph.handleValue(objectId);
            return;
        }
        graph.addObjectReference(baseId, offset, objectId, iid);

        // why do we need this call?  --MS
        graph.handleValue(objectId);
        client.putField(iid, baseId, offset, objectId);
    }

    @Override
    public void write(final int iid, final String name, final int objectId, final Context context) {
        graph.addContextReference(context, name, objectId, iid);

        graph.handleValue(objectId);
        client.write(iid, name, objectId);
    }

    @Override
    public void lastUse(final int objectId, int iid, int time) {
        client.lastUse(objectId, iid, time);
    }

    @Override
    public void functionEnter(final int iid, final int funId, int callSiteIID, final Context newContext) {
        graph.newContext(newContext, funId);
        client.functionEnter(iid, funId, callSiteIID, newContext, timer.currentTime());
    }

    @Override
    public void functionExit(final int iid, final Context calleeContext, final Context callerContext, final Set<String> unReferenced) {
        graph.contextSealed(calleeContext, unReferenced, iid);
        graph.flush(iid, returnValues, contextInfo.getLiveContexts());
        graph.functionExit(returnValues);
        client.functionExit(iid, calleeContext, unReferenced, timer.currentTime());
    }

    @Override
    public void topLevelFlush(final int iid, final Context currentContext) {
        graph.flush(iid, returnValues, contextInfo.getLiveContexts());
        client.topLevelFlush(iid);
    }

    @Override
    public T endExecution(final Context global, Set<String> globalNames) {
        graph.contextSealed(global, globalNames, 0);
        graph.endFlush(0, returnValues, contextInfo.getLiveContexts());
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
    public void updateIID(final int objId, final int newIID) {

        saveAllocationSite(objId,newIID);
        client.updateIID(objId, newIID);
    }


    @Override
    public void debug(final int iid, final int oid, Context currentContext) {
    	graph.flushCycleQueue(returnValues, ReferenceCountedHeapGraph.FlushType.FORCE, contextInfo.getLiveContexts());
    	if (isTesting()) {
            System.out.printf("%s : RC(%s) = %d\n", makeRelative(iidMap.get(iid)),
                    makeRelative(allocationSites.get(oid)), graph.referenceCount(oid));
    	}
        client.debug(iid, oid);
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
    public void createDomNode(int iid, int objectId) {
        domNodes.add(objectId);
    	this.create(iid, objectId);
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
	public void addToChildSet(int iid, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
		graph.addToChildSet(parentNode, name, childNode);
		client.addToChildSet(iid, parentNode.getId(), name, childNode.getId());
	}

	@Override
	public void removeFromChildSet(int iid, ContextOrObjectId parentNode,
			String name, ContextOrObjectId childNode) {
		graph.removeFromChildSet(parentNode, name, childNode, iid);
		client.removeFromChildSet(iid, parentNode.getId(), name, childNode.getId());
	}

	@Override
	public void domRoot(int nodeId) {
		client.domRoot(nodeId);
	}

	@Override
	public void scriptEnter(int iid, String filename) {

		this.client.scriptEnter(iid, filename);
	}

	@Override
	public void scriptExit(int iid) {
		this.client.scriptExit(iid);
	}

}
