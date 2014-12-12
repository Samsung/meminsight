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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.ibm.wala.util.collections.HashMapFactory;
import com.samsung.memoryanalysis.traceparser.IIDMap;
import com.samsung.memoryanalysis.util.Util;

public class ObjectStaleness {

	/**
	 * default value used when some field is unknown
	 */
	public static final int DEFAULT_VAL = -20;

	/**
	 * site to use to indicate last use of a DOM node
	 * was its removal from the visible DOM
	 */
	public static final int REMOVE_FROM_DOM_SITE = -50;

    public final int iid;
    public final int objectId;
    public final long creationTime;
    public final List<Integer> creationCallStack;
    public final ObjectType type;

    public long staleness = DEFAULT_VAL;
    public long lastUseTime = DEFAULT_VAL;
    public long lastUseSite = DEFAULT_VAL;
    public long unreachableTime = DEFAULT_VAL;
    public int unreachableSite = DEFAULT_VAL;
    public int shallowSize = DEFAULT_VAL;


    protected ObjectStaleness(int iid, int objectId, long creationTime, List<Integer> creationCallStack, ObjectType type) {
        this.iid = iid;
        this.objectId = objectId;
        this.creationTime = creationTime;
        this.creationCallStack = creationCallStack;
        this.type = type;
    }

  /*  @Override
    public String toString() {
        return String.format("(iid = %d, objectId = %d, creationTime = %d, unreachableSite = %d, staleness = %d, type = %s)",
                iid, objectId, creationTime, unreachableSite, staleness, type.name());
    }*/


    private List<String> callStackSourceLocs(final boolean relative, final IIDMap iidMap) {
        List<String> result = new ArrayList<String>();
        for (Integer iid : creationCallStack) {
            String s = relative ? Util.makeRelative(iidMap.get(iid)) : iidMap.get(iid).toString();
            result.add(s);
        }
        return result;
    }

    @SuppressWarnings({ "unchecked", "rawtypes" })
    public Map toMap(final IIDMap iidMap, boolean relative, boolean callStackSourceLocs) {
        final Map o = HashMapFactory.make();
        o.put("objectId", objectId);
        o.put("creationTime", creationTime);
        if (callStackSourceLocs) {
        	o.put("creationCallStack", callStackSourceLocs(relative, iidMap));
        } else {
            o.put("creationCallStack", creationCallStack);
        }
        o.put("unreachableTime", unreachableTime);
        String sourceLocation;
        if (unreachableSite == DEFAULT_VAL)
            sourceLocation = "no information";
        else if (unreachableSite == -1)
            sourceLocation = "unknown";
        else if (unreachableSite == 0)
            sourceLocation = "end of program";
        else
            sourceLocation = relative ? Util.makeRelative(iidMap.get(unreachableSite))
                    : iidMap.get(unreachableSite).toString();
        o.put("unreachableSite", sourceLocation);
        o.put("staleness", staleness == DEFAULT_VAL ? -1 : staleness);
        o.put("lastUseTime", lastUseTime == DEFAULT_VAL ? "never used" : lastUseTime);
        o.put("lastUseSite", lastUseSite == DEFAULT_VAL ? "never used" :
        	(lastUseSite == REMOVE_FROM_DOM_SITE ? "removed from DOM" : lastUseSite));
        o.put("shallowSize", shallowSize);
        o.put("type", this.type.toString());
        return o;
    }

    public static enum ObjectType {
        FUNCTION,
        OBJECT,
        DOM,
        PROTOTYPE
    }

	public ObjectStaleness updateIID(int newIID, List<Integer> newCallStack) {
		ObjectStaleness result = new ObjectStaleness(newIID, this.objectId, this.creationTime, newCallStack, this.type);
		// copy everything
		result.staleness = this.staleness;
		result.lastUseTime = this.lastUseTime;
		result.lastUseSite = this.lastUseSite;
		result.unreachableTime = this.unreachableTime;
		result.unreachableSite = this.unreachableSite;
		result.shallowSize = this.shallowSize;

		return result;
	}

}