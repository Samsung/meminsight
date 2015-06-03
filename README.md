MemInsight
==========

MemInsight is a memory profiler for web and node.js applications.
Through code instrumentation, MemInsight collects a detailed trace of
all the memory operations performed by an application during an
execution.  By processing this trace, MemInsight can automatically
find interesting memory-related issues like leaks or excessive,
unnecessary allocation.  For further details, see
[our writeup](https://github.com/Samsung/meminsight/raw/master/doc/meminsight-extended.pdf).

Prerequisites
-------------

* [node.js](http://nodejs.org) v0.10 (v0.12 is **not** supported on
  this branch)
* [Python 2.7](https://www.python.org/download/releases/2.7/)
* [Java](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html) version 7 or higher
* [Gradle](https://www.gradle.org/)

All of the above should be in your `PATH`.  MemInsight has been tested
on Linux and Mac OS X, but not Windows.

Installation
------------

First, install dependencies:

    npm install
    cd node_modules/jalangi
    python scripts/install.py
    cd ../..

Then, compile the TypeScript and Java code:

    ./node_modules/.bin/grunt

To just compile the TypeScript code:

    ./node_modules/.bin/grunt typescript


Instrumentation
---------------

The first step in using MemInsight is to instrument the application
that is to be profiled.  Currently, MemInsight can only instrument web
or node.js applications residing on the local filesystem.  To
instrument an app in local directory `path/to/app`, run the following
command from the `meminsight` directory:

    ./bin/meminsight instrument path/to/app

This will write the instrumented application to folder `/tmp/app`.  To
change the output folder, use the `--outputDir` option.  To only
instrument some of the code in the application, pass the appropriate sub-directories
to the `--only_include` option, separated by the path delimiter.
E.g., to only instrument the `src` directory and `main.js` file, run:

    ./bin/meminsight instrument --only_include src:main.js path/to/app

Further help can be obtained by running `./bin/meminsight instrument
--help`.

Trace Collection
----------------

After instrumentation, the instrumented app must be run to collect a
trace.  We assume the instrumented app is in `/tmp/app`.

### Web apps

To exercise an instrumented web application, run the following
command:

    ./bin/meminsight run /tmp/app

This will start a webserver running at `http://localhost:8888`.  Open
this URL in your browser to load the application, and then exercise
it.  To detect issues like leaks, it is best to repeatedly perform a
set of interactions, such that all temporary state should be cleaned
up after the interactions.  When you are done exercising the
application, type `end` and press return in the terminal where you ran
the command.  You will see an alert in the browser window when trace
generation is complete.  In the terminal, you will see output like the
following: 

```
$ ./bin/meminsight run /tmp/htmlTest1
running app /tmp/htmlTest1
Serving /tmp/htmlTest1 on http://localhost:8888
Tue Jun 02 2015 16:51:51 GMT-0700 (PDT) Server is listening on port 8082
Tue Jun 02 2015 16:52:01 GMT-0700 (PDT) Connection accepted.  Type 'end' and press enter to stop trace generation in the app.
end
stopping tracingTue Jun 02 2015 16:52:04 GMT-0700 (PDT) Peer 127.0.0.1 disconnected. 1006 Connection dropped by remote peer.
completing lifetime analysis...lifetime finish: 57ms
done
run of app  complete
$
```
When the program exits, the trace collection and post-processing is
complete.

### node.js apps

A node.js application can be exercised using the `meminsight noderun`
command.  E.g., to exercise script `main.js` in instrumented app `/tmp/app`, run:

    ./bin/meminsight noderun /tmp/app/main.js args

`args` are the usual command-line arguments for `main.js`.  At this
point, we only support node programs that can be exited without
killing them at the command line.  Once the instrumented program
exits, the lifetime analysis will run, after which trace collection
and post-processing is complete.

Inspecting Results
------------------

To inspect the MemInsight results for an instrumented app in
`/tmp/app` that has been exercised as described above, run:

    ./bin/meminsight inspect /tmp/app

Then, open `http://localhost:9000` in your browser to view the GUI.

### Issue Table View

![Issue Table View](/doc/screenshots/table-view.png?raw=true "Issue Table View")

When opened, the GUI first shows the issue table view, as seen above.
Note that it may take some time for this page to load, as the server
is doing further processing of the trace data.  The page includes
explanations for the different columns.  You can sort by any of the
columns, or filter on any table text using the search box.  The
absolute values in the "Leak," "Staleness," "Inline-able," and
"Non-escaping" columns are not meaningful at this time; they are
simply intended to rank the issues by interestingness or severity.
Clicking on any site will open the Allocation Site View for the site
(described further below) in a separate tab.

### All-Sites Timeline

![All-Sites Timeline](/doc/screenshots/timeline.png?raw=true "All-Sites Timeline")

An alternate high-level view is the all-sites timeline, obtained by
clicking the "All-Sites Timeline" link at the top of the page.  As
seen above, this view shows a timeline of the number of live objects
during the execution.  The darker plot in the timeline shows the
number of stale objects across time (an object is stale if it is still
reachable but will not be used again during the execution).  Hovering
over the timeline shows the number of allocated and stale objects at
that time.  (Note that time is a synthetic measure, unrelated to the
wall-clock running time of the app.)  The left and right pie charts at
the bottom respectively break down the number of allocated and stale
objects by allocation site.  Clicking on a new point on the timeline
will update the pie charts.  (Initially, the selected time corresponds
to the maximum number of allocated objects.)  Clicking the pie slice
for any allocation site will open up the Allocation Site View for that
site in a separate tab.

### Allocation Site View

![Allocation Site View](/doc/screenshots/alloc-site-view.png?raw=true "Allocation Site View")

The allocation site view gives detailed information on the behavior of
objects allocated from a particular site (an object literal,
constructor call, function literal, etc.).  The upper left is a source
view that initially highlights the allocation site.  The upper right
is a call tree, showing the call stacks under which the site
executed.  Clicking any node in the call tree will update the source
view accordingly.  The lower left shows a timeline of allocated and
stale objects for the site, analogous to the all-sites timeline.
Clicking on a particular time point populates the lower-right access
paths view with the paths through the heap that lead to objects from
the site at that point in time.  Like the call tree, clicking a node
in the access path tree will update the source view.

License
-------

MemInsight is distributed under the
[Apache License](http://www.apache.org/licenses/LICENSE-2.0.html).
