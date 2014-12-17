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
package com.samsung.memoryanalysis.context;

import java.lang.ref.WeakReference;
import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Deque;
import java.util.Map;
import java.util.Set;

import com.ibm.wala.util.collections.HashMapFactory;
import com.samsung.memoryanalysis.options.MemoryAnalysisOptions;
import com.samsung.memoryanalysis.referencecounter.heap.ContextOrObjectId;
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.traceparser.Timer;
import com.samsung.memoryanalysis.traceparser.TraceAnalysis;

/**
 * Context provider for analyses that need context information.
 * @author s.jensen
 */
public class ContextProvider <T> implements TraceAnalysis<T> {

    private final ContextAwareAnalysis<T> callbacks;

    private final Deque<Context> contextStack = new ArrayDeque<Context>();

    private final Map<Integer, WeakReference<Context>> contexts = HashMapFactory.make();

    private final Context GLOBAL;

    private final MemoryAnalysisOptions options;

    public static final int GLOBAL_OBJECT_ID = 1;
    private IIDMap iidMap;

    public ContextProvider(ContextAwareAnalysis<T> s, MemoryAnalysisOptions options) {
        this.options = options;
        GLOBAL = Context.makeGlobal();
        this.callbacks = s == null ? new DummyContextAwareAnalysis<T>() : s;
    }

    @Override
    public void init(Timer timer, IIDMap iidMap) {
        contextStack.push(GLOBAL);
        this.iidMap = iidMap;
        ContextListener c = new ContextListener() {
            @Override
            public Context getGlobal() {
                return GLOBAL;
            }

            @Override
            public Context getCurrent() {
                return contextStack.peek();
            }

            @Override
            public Collection<Context> getLiveContexts() {
                return contextStack;
            }
        };
        callbacks.init(timer, c, iidMap);
    }

    @Override
    public void declare(int iid, String name, int objectId) {
    	if (objectId == GLOBAL_OBJECT_ID) {
    		// treat as writing null; we don't want global object id
    		// floating around
    		objectId = 0;
    	}
        Context ctx = contextStack.peek();
        ctx.newVariable(iid, name, objectId);
        callbacks.declare(iid, name, objectId, ctx);
    }

    @Override
    public void create(int iid, int objectId) {
        callbacks.create(iid, objectId);
    }

    @Override
    public void createFun(int iid, int objectId, int prototypeId, int functionEnterIID, Set<String> namesReferencedByClosures) {
        Context curr = contextStack.peek();
        curr.markReferenced(namesReferencedByClosures);
        contexts.put(objectId, new WeakReference<Context>(curr));
        callbacks.createFun(iid, objectId, prototypeId, functionEnterIID,namesReferencedByClosures, contextStack.peek());
    }

    @Override
    public void putField(int iid, int baseId, String offset, int objectId) {
    	if (baseId == GLOBAL_OBJECT_ID) {
    		// treat as a write to global variable
    		this.write(iid, offset, objectId);
    	} else {
    		if (objectId == GLOBAL_OBJECT_ID) {
        		// treat as writing null; we don't want global object id
        		// floating around
        		objectId = 0;
    		}
            callbacks.putField(iid,baseId, offset, objectId);
    	}
    }

    @Override
    public void write(int iid, String name, int objectId) {
    	if (objectId == GLOBAL_OBJECT_ID) {
    		// treat as writing null; we don't want global object id
    		// floating around
    		objectId = 0;
    	}
        Context ctx = contextStack.peek();
        Context res = ctx.writeToVariable(iid,name,objectId);
        callbacks.write(iid,name,objectId, res);
    }

    @Override
    public void lastUse(int objectId, int iid, int time) {
        callbacks.lastUse(objectId, iid, time);
    }


    @Override
	public void functionEnter(int iid, int functionId, int callSiteIID) {
        WeakReference<Context> contextWeakRef = contexts.get(functionId);
        Context context = null;
        if (contextWeakRef == null) {
            // TODO this is due to a bug in jalangi's handling of eval
            // should be fixed when we move to jalangi2; work around it for now
//            assert contextWeakRef != null : "no context ever discovered!!! iid " + iid + " functionId " + functionId + " callSiteIID " + callSiteIID;
            context = GLOBAL;
        } else {
            context = contextWeakRef.get();
            if (context == null) {
//                System.err.println("missing context!!! iid " + iid + " function id " + functionId + " call site IID " + callSiteIID);
                // TODO this could cause imprecision.  eventually, need a way to revive contexts for revived functions
                context = GLOBAL;
            }
        }
        Context ctx = new Context(context, iidMap.get(iid).toString());
        contextStack.push(ctx);
        callbacks.functionEnter(iid, functionId, callSiteIID, ctx);
    }

    @Override
    public void functionExit(int iid) {
        Context ctx = contextStack.pop();
        Set<String> unReferenced = ctx.seal();
        callbacks.functionExit(iid,ctx, contextStack.peek(), unReferenced);
    }

    @Override
    public void topLevelFlush(int iid) {
       callbacks.topLevelFlush(iid, contextStack.peek());
    }

    @Override
    public T endExecution() {
        Set<String> c = GLOBAL.seal();
        return callbacks.endExecution(GLOBAL,c);
    }



    @Override
    public void updateIID(int objId, int newIID) {
        callbacks.updateIID(objId, newIID);
    }

    @Override
    public void debug(int iid, int oid) {
         callbacks.debug(iid, oid, contextStack.peek());
    }

    @Override
    public void returnStmt(int i) {
        callbacks.returnStmt(i);
    }

    @Override
    public void createDomNode(int iid, int objectId) {
        callbacks.createDomNode(iid, objectId);
    }

    @Override
    public void addDOMChild(int parentId, int childId) {
        callbacks.addDOMChild(parentId,childId);
    }

    @Override
    public void removeDOMChild(int parentId, int childId) {
        callbacks.removeDOMChild(parentId,childId);
    }

	@Override
	public void addToChildSet(int iid, int parent, String name, int child) {
		if (child == GLOBAL_OBJECT_ID) {
			// we don't care about tracking pointers to global object
			return;
		}
		ContextOrObjectId parentNode = parent == GLOBAL_OBJECT_ID ? ContextOrObjectId.make(GLOBAL) : ContextOrObjectId.make(parent);
		ContextOrObjectId childNode = ContextOrObjectId.make(child);
		callbacks.addToChildSet(iid,parentNode,name,childNode);
	}

	@Override
	public void removeFromChildSet(int iid, int parent, String name, int child) {
		if (child == GLOBAL_OBJECT_ID) {
			// we don't care about tracking pointers to global object
			return;
		}
		ContextOrObjectId parentNode = parent == GLOBAL_OBJECT_ID ? ContextOrObjectId.make(GLOBAL) : ContextOrObjectId.make(parent);
		ContextOrObjectId childNode = ContextOrObjectId.make(child);
		callbacks.removeFromChildSet(iid,parentNode,name,childNode);
	}

	@Override
	public void domRoot(int nodeId) {
		callbacks.domRoot(nodeId);
	}

	@Override
	public void scriptEnter(int iid, String filename) {
        if (options.isModuleScope()) {
            Context moduleContext = new Context(GLOBAL, "module " + filename);
            contextStack.push(moduleContext);
        }
		callbacks.scriptEnter(iid, filename);
	}

	@Override
	public void scriptExit(int iid) {
        if (options.isModuleScope()) {
            contextStack.pop();

        }
		callbacks.scriptExit(iid);
	}


}
