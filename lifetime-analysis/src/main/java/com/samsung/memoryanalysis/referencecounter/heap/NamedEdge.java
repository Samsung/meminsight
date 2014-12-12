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

/**
 * Created by s.jensen on 6/11/14.
 */
public class NamedEdge implements HeapEdge {

    //TODO: Canonicalize

    private final ContextOrObjectId from;
    private final String name;
    public NamedEdge(ContextOrObjectId from, String name) {
        this.from = from;
        this.name = name;
    }

    public ContextOrObjectId getFrom() {
        return from;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        NamedEdge namedEdge = (NamedEdge) o;

        if (from != null ? !from.equals(namedEdge.from) : namedEdge.from != null) return false;
        if (name != null ? !name.equals(namedEdge.name) : namedEdge.name != null) return false;

        return true;
    }

    @Override
    public int hashCode() {
        int result = from != null ? from.hashCode() : 0;
        result = 31 * result + (name != null ? name.hashCode() : 0);
        return result;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
