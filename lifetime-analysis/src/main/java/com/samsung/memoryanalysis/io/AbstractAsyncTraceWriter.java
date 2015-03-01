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
package com.samsung.memoryanalysis.io;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.AsynchronousFileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.ibm.wala.util.collections.HashSetFactory;

/**
 * superclass for taking a stream of data and writing it to a file
 * asynchronously.  Subclasses should append output to the builder field, and call flushWhenNeeded()
 * periodically to check if output needs to be flushed.  Call close() to
 * force all output to disk.
 */
public abstract class AbstractAsyncTraceWriter {

    private final AsynchronousFileChannel out;

    protected StringBuilder builder = new StringBuilder();

    private static final int CHAR_LIMIT =  64000;

    private long byteOffset = 0;

    private final ExecutorService ioExecutor;

    /**
     *
     */
    public AbstractAsyncTraceWriter(Path path) throws IOException {
        super();
        Files.deleteIfExists(path);
        ioExecutor = Executors.newSingleThreadExecutor();
        StandardOpenOption[] options = new StandardOpenOption[] { StandardOpenOption.WRITE, StandardOpenOption.CREATE };
        this.out = AsynchronousFileChannel.open(path, HashSetFactory.make(Arrays.asList(options)), ioExecutor);
    }

    public void flushIfNeeded() {
        if (builder.length() >= CHAR_LIMIT) {
            doFlush();
        }
    }

    private void doFlush() {
        byte[] bytes = builder.toString().getBytes();
        int curLen = bytes.length;
        out.write(ByteBuffer.wrap(bytes), byteOffset);
        byteOffset += curLen;
        builder.setLength(0);
    }

    public void close() throws IOException {
        doFlush();
        out.force(true);
        ioExecutor.shutdown();
        try {
            ioExecutor.awaitTermination(1, TimeUnit.MINUTES);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        out.close();
    }
}
