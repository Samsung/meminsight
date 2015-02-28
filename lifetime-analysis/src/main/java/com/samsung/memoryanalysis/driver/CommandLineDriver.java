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
package com.samsung.memoryanalysis.driver;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

import joptsimple.OptionParser;
import joptsimple.OptionSet;
import joptsimple.OptionSpec;

import com.ibm.wala.util.collections.HashMapFactory;
import com.samsung.memoryanalysis.context.ContextProvider;
import com.samsung.memoryanalysis.options.MemoryAnalysisOptions;
import com.samsung.memoryanalysis.referencecounter.DummyUnreachabilityAnalysis;
import com.samsung.memoryanalysis.referencecounter.ReferenceCounter;
import com.samsung.memoryanalysis.referencecounter.UnreachabilityAwareDuplex;
import com.samsung.memoryanalysis.referencecounter.UnreachabilityTraceWriter;
import com.samsung.memoryanalysis.referencecounter.UnreachabilityTraceWriter.TraceFormatter;
import com.samsung.memoryanalysis.referencecounter.heap.JGraphHeap;
import com.samsung.memoryanalysis.staleness.Staleness;
import com.samsung.memoryanalysis.staleness.StalenessAnalysis;
import com.samsung.memoryanalysis.traceparser.ProgressMonitor;
import com.samsung.memoryanalysis.traceparser.TraceAnalysisRunner;
import com.samsung.memoryanalysis.traceparser.TracePrettyPrinter;
import com.samsung.memoryanalysis.util.Pair;

/**
 * Created by s.jensen on 6/12/14.
 */
public class CommandLineDriver {

    private static int lastPercent = -1;

    public static void printProgBar(int total, int prog) {
        final int percent = (int) (((float) prog) / ((float) total) * 100);
        if (percent > lastPercent) {
            lastPercent = percent;
        } else
            return;

        final StringBuilder bar = new StringBuilder("[");
        for (int i = 0; i < 50; i++) {
            if (i < (percent / 2)) {
                bar.append("=");
            } else if (i == (percent / 2)) {
                bar.append(">");
            } else {
                bar.append(" ");
            }
        }
        bar.append(String.format("]    %d%%   (%d/%d)    ", percent, prog, total));
        System.out.print("\r" + bar.toString());
    }

    public static void main(String[] args) throws IOException, InterruptedException {
        final OptionParser parser = new OptionParser();
        parser.accepts("context", "Run only the context analysis");
        parser.accepts("ref", "Run the reference count analysis only");
        parser.accepts("staleness", "Run the staleness analysis");
        parser.accepts("pretty-print", "Just parse and pretty print the trace");
        parser.accepts("no-progress", "Don't print progress bar");
        parser.accepts("access-paths",
                "Reads object ids on stdin and timestamp on stdin, prints access paths on stdout");
        parser.accepts("enhanced", "If doing staleness, will also generate the enhanced trace in cwd");
        parser.accepts("nodejs", "Model the module scope of nodejs");
        OptionSpec<String> traceOpt = parser.accepts("trace", "Trace file to analyze").withRequiredArg()
                .describedAs("trace file").ofType(String.class);
        OptionSpec<String> dirOpt = parser.accepts("directory", "Directory containing the instrumented source code")
                .withRequiredArg().describedAs("directory").ofType(String.class);
        final OptionSet options = parser.parse(args);
        InputStream traceStream;
        File dir = null;
        if (options.has(traceOpt)) {
            String file = options.valueOf(traceOpt);
            traceStream = new BufferedInputStream(new FileInputStream(file));
            dir = new File(file).getParentFile();
        } else {
            traceStream = System.in;
            if (options.has(dirOpt))
                dir = new File(options.valueOf(dirOpt));
            else {
                System.out.println("In streaming mode you must provide a directory (with --directory)");
                System.exit(1);
            }

        }

        ProgressMonitor prog = new ProgressMonitor() {
            int total;

            @Override
            public void start(int total) {
                this.total = total;
            }

            @Override
            public void tick(int progress) {
                if (!options.has("no-progress"))
                    printProgBar(total, progress);
            }
        };
        MemoryAnalysisOptions refOptions = new MemoryAnalysisOptions();
        if (options.has("nodejs")) {
            refOptions.setModuleScope();
        }
        if (options.has("ref")) {
            ReferenceCounter<Void> f = new ReferenceCounter<Void>(new JGraphHeap(), null, refOptions);
            new TraceAnalysisRunner(traceStream, prog, dir).runAnalysis(new ContextProvider<Void>(f, refOptions));
            // System.out.println(res);
        } else if (options.has("context")) {
            new TraceAnalysisRunner(traceStream, prog, dir).runAnalysis(new ContextProvider<Void>(null, refOptions));
        } else if (options.has("staleness")) {
            if (options.has("enhanced")) {
                UnreachabilityAwareDuplex<Staleness, TraceFormatter> analysis;
                Path pf = Paths.get(dir.getAbsolutePath(), "enhanced-trace");
                UnreachabilityTraceWriter aw = new UnreachabilityTraceWriter(pf);
                analysis = new UnreachabilityAwareDuplex<Staleness,TraceFormatter>(new StalenessAnalysis(), aw);
                ReferenceCounter<Pair<Staleness, TraceFormatter>> f = new ReferenceCounter<Pair<Staleness, TraceFormatter>>(new JGraphHeap(),
                        analysis, refOptions);
                Pair<Staleness, TraceFormatter> p = new TraceAnalysisRunner(traceStream, prog, dir)
                        .runAnalysis(new ContextProvider<Pair<Staleness, TraceFormatter>>(f, refOptions));
                p.first.toJSON(System.out, false);
                p.second.close();
            } else {
                ReferenceCounter<Staleness> f = new ReferenceCounter<Staleness>(new JGraphHeap(),
                        new StalenessAnalysis(), refOptions);
                Staleness staleness = new TraceAnalysisRunner(traceStream, prog, dir)
                        .runAnalysis(new ContextProvider<Staleness>(f, refOptions));
                staleness.toJSON(System.out, false);
            }
        } else if (options.has("pretty-print")) {
            new TraceAnalysisRunner(traceStream, prog, dir).runAnalysis(new TracePrettyPrinter());
        } else if (options.has("access-paths")) {
            BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
            final Map<Integer, Integer> watchList = HashMapFactory.make();
            String line;
            while ((line = in.readLine()) != null) {
                String[] comp = line.split(",");
                assert comp.length == 2;
                int objectId = Integer.parseInt(comp[0]);
                int printAtTime = Integer.parseInt(comp[1]);
                watchList.put(objectId, printAtTime);
            }
            refOptions.setAccessPathObjects(watchList);
            ReferenceCounter<Void> f = new ReferenceCounter<Void>(new JGraphHeap(),
                    new DummyUnreachabilityAnalysis<Void>(), refOptions);
            new TraceAnalysisRunner(traceStream, prog, dir).runAnalysisJSON(new ContextProvider<Void>(f, refOptions));
        }
    }
}
