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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.ibm.wala.util.collections.HashMapFactory;

/**
 * Created by s.jensen on 7/25/14.
 */
public class AccessPath {
    public static final AccessPath NO_PATH = new AccessPath();


    public static class AccessPathElement {
        public final String node;
        public final String prop;

        public AccessPathElement(String prop, String node) {
            this.prop = prop;
            this.node = node;
        }

        public Map<String,Object> toMap() {
            Map<String,Object> res = HashMapFactory.make();
            res.put("object", node);
            res.put("property", prop);
            return res;
        }
    }

    public final String target;
    public final List<AccessPathElement> path;

    public AccessPath(String target, List<AccessPathElement> path) {
        this.target = target;
        this.path = path;
    }

    @Override
	public String toString() {
        final StringBuilder b = new StringBuilder();
        for (AccessPathElement elm : path) {
            b.append(elm.node);
            b.append("[").append(elm.prop).append("]->");
        }
        b.append(target);
        return b.toString();
    }

    private AccessPath() {
        target = null;
        path = null;
    }

    public Map<String,Object> toMap() {
        Map<String,Object> res = HashMapFactory.make(2);
        final List<Map<String,Object>> pathMaps = new ArrayList<Map<String,Object>>();
        for (AccessPathElement g : path) {
            pathMaps.add(g.toMap());
        }
        res.put("path", pathMaps);
        res.put("target", target.toString());
        return res;
    }
}
