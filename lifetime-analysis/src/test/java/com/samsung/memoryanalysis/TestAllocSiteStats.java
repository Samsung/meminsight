/*
 * Copyright 2015 Samsung Information Systems America, Inc.
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
package com.samsung.memoryanalysis;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import com.samsung.memoryanalysis.allocstats.AllocationSiteStats;
import com.samsung.memoryanalysis.context.ContextProvider;
import com.samsung.memoryanalysis.options.MemoryAnalysisOptions;
import com.samsung.memoryanalysis.referencecounter.ReferenceCounter;
import com.samsung.memoryanalysis.referencecounter.heap.JGraphHeap;
import com.samsung.memoryanalysis.staleness.StreamingStalenessAnalysis;
import com.samsung.memoryanalysis.traceparser.EnhancedTraceAnalysisRunner;
import com.samsung.memoryanalysis.traceparser.TraceAnalysisRunner;

@RunWith(Parameterized.class)
public class TestAllocSiteStats extends AbstractTester {

    private final static String FILE_PATTERN = "testAllocSiteStats";

    public TestAllocSiteStats(TestCaseInfo file) {
        super(file);
    }

    /* (non-Javadoc)
     * @see com.samsung.memoryanalysis.AbstractTester#runAnalysis(java.io.File)
     */
    @Override
    protected String runAnalysis(File trace) throws Exception {
        StringBuilder r = redirect();
        ByteArrayOutputStream lastUse = new ByteArrayOutputStream(), unreach = new ByteArrayOutputStream(),
                updiid = new ByteArrayOutputStream(), streamOutput = new ByteArrayOutputStream();
        StreamingStalenessAnalysis client = new StreamingStalenessAnalysis(streamOutput, lastUse, unreach, updiid);
        client.debug = true;
        ReferenceCounter<Void> f = new ReferenceCounter<Void>(new JGraphHeap(), client);
        // gross.  we want some output even if analysis fails with an assertion
        try {
            FileInputStream traceInputStream = new FileInputStream(trace);
            new TraceAnalysisRunner(traceInputStream, null, trace.getParentFile()).runAnalysis(new ContextProvider<Void>(f, new MemoryAnalysisOptions()));
            traceInputStream.close();
            traceInputStream = new FileInputStream(trace);
            ByteArrayInputStream lastUseIn = new ByteArrayInputStream(lastUse.toByteArray());
            ByteArrayInputStream unreachIn = new ByteArrayInputStream(unreach.toByteArray());
            ByteArrayInputStream iidIn = new ByteArrayInputStream(updiid.toByteArray());
            new EnhancedTraceAnalysisRunner(traceInputStream, lastUseIn, unreachIn, iidIn, null, trace.getParentFile()).runAnalysis(new AllocationSiteStats());
            revert();
            return r.toString();
        } catch (AssertionError e) {
            revert();
            System.out.println(r.toString());
            throw e;
        }
    }

    @Parameterized.Parameters(name="{0}")
    public static Collection<Object[]> data() throws IOException {
        System.setProperty("testing", "yes");
        System.setProperty("rcverbose", "no");
        File dir = new File(TESTDATA);
        List<Object[]> res = new ArrayList<Object[]>();
        addMatchingJS(dir, res, FILE_PATTERN);
        return res;
    }

    @Override
    protected String getExpectedFileName(TestCaseInfo tcInfo) {
        return tcInfo.name + ".allocsitestats.expected";
    }

}
