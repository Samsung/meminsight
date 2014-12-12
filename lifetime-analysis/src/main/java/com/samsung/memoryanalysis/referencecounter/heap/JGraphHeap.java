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
import java.util.Collections;
import java.util.Iterator;
import java.util.Set;

import org.jgrapht.DirectedGraph;
import org.jgrapht.graph.DirectedPseudograph;
import org.jgrapht.traverse.BreadthFirstIterator;

import com.ibm.wala.util.collections.HashSetFactory;

/**
 * Heap representation backed by JGraphT
 * Created by s.jensen on 6/11/14.
 */
public class JGraphHeap extends ReferenceCountedHeapGraph {

    private final DirectedGraph<ContextOrObjectId, HeapEdge> heap;

    public JGraphHeap(){
        heap = new DirectedPseudograph<ContextOrObjectId, HeapEdge>(HeapEdge.class);
    }

    @Override
    public void newNode(ContextOrObjectId o) {
        //System.out.println("Adding : " + o);
        heap.addVertex(o);
    }

    @Override
    public void addEdge(NamedEdge e, ContextOrObjectId to) {
        heap.addEdge(e.getFrom(), to, e);
    }

    @Override
    protected void removeEdge(HeapEdge e) {
    	heap.removeEdge(e);
    }

    protected void removeNode(ContextOrObjectId node) {
     //   System.out.printf("Removing: " + node + "\n");
        heap.removeVertex(node);
    }

    @Override
    protected java.util.Iterator<ContextOrObjectId> bfsIterator(ContextOrObjectId start) {
        assert heap.containsVertex(start);
        return new BreadthFirstIterator<ContextOrObjectId, HeapEdge>(heap, start);
    }

    @Override
    protected Iterator<ContextOrObjectId> bfsIterator() {
        return new BreadthFirstIterator<ContextOrObjectId, HeapEdge>(heap);
    }

    @Override
    public int referenceCount(ContextOrObjectId node) {
        if (!heap.containsVertex(node))
            return 0;
        return heap.inDegreeOf(node);
    }

    @Override
    public boolean containsNode(ContextOrObjectId v) {
        return heap.containsVertex(v);
    }

    @Override
    public Set<HeapEdge> incoming(ContextOrObjectId c) {
    	return heap.incomingEdgesOf(c);
//    	Set<NamedEdge> result = new LinkedHashSet<>();
//    	heap.incomingEdgesOf(c).stream().forEach(e -> { if (e instanceof NamedEdge) result.add((NamedEdge)e); });
//        return result;
    }

    @Override
    public void toDot(Writer w) {
        //TODO

    }

    @Override
    public Set<ContextOrObjectId> getAllNodes() {
        return heap.vertexSet();
    }

    @Override
    protected int getOutDegree(ContextOrObjectId obj) {
        return heap.containsVertex(obj) ? heap.outDegreeOf(obj) : 0;
    }

    @Override
    public Set<HeapEdge> getOutEdges(ContextOrObjectId node) {
        if (!heap.containsVertex(node))
            return Collections.emptySet();
        return heap.outgoingEdgesOf(node);
    }

	@Override
	public Set<NamedEdge> getNamedOutEdges(ContextOrObjectId node) {
		Set<NamedEdge> result = HashSetFactory.make();
		for (HeapEdge e: getOutEdges(node)) {
            if (e instanceof NamedEdge)
                result.add((NamedEdge) e);
		}
		return result;
	}

    @Override
    /**
     *
     * @param e
     * @return target of edge, or null if no such edge in heap
     */
    public ContextOrObjectId getTarget(HeapEdge e) {
        return heap.containsEdge(e) ? heap.getEdgeTarget(e) : null;
    }

	@Override
	protected void addNamedMultiEdge(NamedMultiEdge edge) {
		heap.addEdge(edge.getFrom(), edge.getChild(), edge);
	}

}
