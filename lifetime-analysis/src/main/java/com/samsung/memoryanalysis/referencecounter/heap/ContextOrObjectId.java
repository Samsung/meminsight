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

import java.lang.ref.WeakReference;
import java.util.Map;
import java.util.WeakHashMap;

import com.ibm.wala.util.collections.HashMapFactory;
import com.samsung.memoryanalysis.context.Context;

/**
 * Created by s.jensen on 6/10/14.
 */
public class ContextOrObjectId {

    private final static Map<Integer, WeakReference<ContextOrObjectId>> intMap = HashMapFactory.make();
    private final static WeakHashMap<Context, WeakReference<ContextOrObjectId>> contextMap = new WeakHashMap<Context, WeakReference<ContextOrObjectId>>();

    public enum Type {
        CONTEXT, ID;
    }

    public final Type type;

    final private int id;
    final private Context context;

    public static ContextOrObjectId make(Context c) {
        WeakReference<ContextOrObjectId> ref = contextMap.get(c);
        ContextOrObjectId res = ref == null ? null : ref.get();
        if (res == null) {
            res = new ContextOrObjectId(c);
            contextMap.put(c, new WeakReference<ContextOrObjectId>(res));
        }
        return res;
    }

    public static ContextOrObjectId make(int id) {
        WeakReference<ContextOrObjectId> ref = intMap.get(id);
        ContextOrObjectId res = ref == null ? null : ref.get();
        if (res == null) {
            res = new ContextOrObjectId(id);
            intMap.put(id, new WeakReference<ContextOrObjectId>(res));
        }
        return res;
    }

    private ContextOrObjectId(Context c) {
        id = -1;
        this.context = c;
        type = Type.CONTEXT;
    }

    private ContextOrObjectId(int id) {
        this.id = id;

        this.context = null;
        type = Type.ID;
    }

    @Override
    public String toString() {
        switch (type) {
            case CONTEXT:
                return context.toString();
            case ID: return ""+id;
        }
        return null;
    }

    /**
     *
     * @return context or null if none
     */
    public Context getContext() {
        return context;
    }

    /**
     *
     * @return id or null if none
     */
    public int getId() {
        return id;
    }
}
