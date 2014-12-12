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

import java.util.Collections;
import java.util.Map;
import java.util.Set;

import com.ibm.wala.util.collections.HashMapFactory;
import com.ibm.wala.util.collections.HashSetFactory;

/**
 *
 * A context is a set of variable bindings, typically associated with a
 * function execution / closure.
 *
 * @author s.jensen
 */
public class Context {

    private final Context parent;
    private final String iidString;
    private Map<String, Variable> variables = HashMapFactory.make();
    private Set<String> referencedNames = HashSetFactory.make();
    private boolean isLive = true;

    /**
     * get parent, or null if no parent
     */
    public Context getParent() {
        return parent;
    }

    private Context() {
        iidString = "GLOBAL";
        parent = null;
    }

    public boolean isLive() {
        return isLive;
    }

    public Context(Context parent, String iidString) {
        this.iidString = iidString;
        if (parent == null) {
            throw new IllegalArgumentException("Null parent only allowed for global");
        }
        this.parent = parent;
    }

    /**
     * Creates a global context with no parent.
     * @return
     */
    public static Context makeGlobal() {
        return new Context();
    }

    public boolean isGlobal() {
        return this.parent == null;
    }

    public void newVariable(int iid, String name, int objectId) {
//        assert !variables.containsKey(name) : "already saw declaration of variable " + name;
        if (!variables.containsKey(name)) { // just ignore if we've already seen the variable
            variables.put(name, new Variable(iid, objectId));
        }
    }

    public boolean hasVariable(String name) {
        return variables.containsKey(name);
    }

    /**
     * Mark the given names as being referenced by a closure in this context and
     * parents.
     *
     * @param names
     */
    public void markReferenced(Set<String> names) {
        if (names == null)
            return ;
        this.referencedNames.addAll(names);
    }

    /**
     * Seals the context, making it impossible to add more variables.
     *
     * @return The set of variables who are not referenced by closures and
     * therefore no longer reachable from this context.
     */
    public Set<String> seal() {
    	// first, appropriately mark all referenced variables in this context
    	// and parents
        Set<String> work = HashSetFactory.make(referencedNames);
        Context c = this;
        while (!c.isGlobal()) {
            for (Map.Entry<String, Variable> v : c.variables.entrySet()) {
                if (work.contains(v.getKey())) {
                    v.getValue().makeReferenced();
                    work.remove(v.getKey());
                }
            }
            c = c.parent;
        }
        // we can GC the referenced names set now that we are sealing
        referencedNames = null;
        isLive = false;
        Set<String> res = HashSetFactory.make();
        for (Map.Entry<String, Variable> v: variables.entrySet()) {
            if (!v.getValue().isReferenced()) {
                res.add(v.getKey());
            }
        }
        for (String s : res) {
            variables.remove(s);
        }
        variables = Collections.unmodifiableMap(variables);
        return res;
    }

    @Override
    public String toString() {
        return "C(" + this.iidString + ")";
    }

    public Context writeToVariable(int iid, String name, int objectId) {
        Context c = this;
        while (c != null) {
            if (c.hasVariable(name)) {
                c.variables.get(name).setValue(objectId);
                return c;
            }
            if (c.isGlobal()) {
                c.newVariable(iid,name,objectId);
                return c;
            }
            c = c.parent;
        }
        throw new IllegalStateException();
    }
}
