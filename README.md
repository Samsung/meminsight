MemInsight
==========

MemInsight is a memory profiler for web and node.js applications.
Through code instrumentation, MemInsight collects a detailed trace of
all the memory operations performed by an application during an
execution.  By processing this trace, MemInsight can automatically
find interesting memory-related issues like leaks or excessive,
unnecessary allocation.  For further details, see
[our technical report](http://manu.sridharan.net/files/MemInsightTR.pdf).

Prerequisites
-------------

* [node.js](http://nodejs.org) v0.10 or greater
* [Java](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html) version 7 or higher
* [Gradle](https://www.gradle.org/)

We require that `node`, `java`, and `gradle` be on your `PATH`.

Installation
------------

First, install dependencies:

    npm install

Then, compile the TypeScript and Java code:

    ./node_modules/.bin/grunt

To just compile the TypeScript code:

    ./node_modules/.bin/grunt typescript

Collecting A Trace
------------------

The first step in using MemInsight is to collect a trace for the
application of interest.  Trace collection requires instrumenting the
application code (via
[Jalangi 2](https://github.com/Samsung/jalangi2)), and then running
and exercising the instrumented app, which generates the trace.
MemInsight supports two instrumentation modes:

* *Online instrumentation*, which instruments the application code
as it gets loaded for execution.
* *Offline instrumentation*, in which the relevant code is
instrumented in an initial phase, separate from running the
instrumented app.

In general, online instrumentation is preferable, unless you plan to
do multiple runs of an instrumented app, in which case the offline
approach will do the instrumentation once-and-for-all.  We describe
how to use both of these schemes below
([online](#online-instrumentation) and
[offline](#offline-instrumentation)). 

### Online Instrumentation

#### node.js apps

A node.js application can be instrumented and exercised using the
`meminsight nodeinstrun` command.  E.g., to instrumented and exercise
script `main.js` in app `path/to/app`, run:

    ./bin/meminsight nodeinstrun path/to/app/main.js args

`args` are the usual command-line arguments for `main.js`.  At this
point, we only support node programs that can be exited without
killing them at the command line.  Once the instrumented program
exits, the lifetime analysis will run, after which trace collection
and post-processing is complete.  Note that the trace files will be
stored in `path/to/app`, so it is this directory that should be passed
to the `meminsight inspect` command (detailed [below](#inspecting-results)).

#### Web apps

We have preliminary support for collecting a trace for a web
application running on a remote server.  This support relies on the
support for [mitmproxy](https://mitmproxy.org/) added in Jalangi 2.
This library allows for proxying both HTTP and HTTPS connections.  To
get started, you'll need to have Python 2.7 on your machine.  Then,
you'll need to
[install mitmproxy](https://mitmproxy.org/doc/install.html).  Our
support assumes that the `mitmdump` script from that library is in
your `PATH`.  If you are interested in instrumenting an app that is
served over HTTPS, please see
[these instructions](https://mitmproxy.org/doc/certinstall.html) on
enabling the `mitmproxy` certificate authority.

Once you have the pre-requisites installed, you can start up the
proxy server process by running the following command from the
`meminsight` directory:

    ./bin/meminsight proxy path/to/output

Here, `path/to/output` should be the path where you want the
instrumented scripts and MemInsight trace files to be stored.  Running
this command causes two servers to be launched:

1. A web proxy server, running on port `8501`
2. The MemInsight websocket server (for recording the trace), running
on port `8080`

(We plan on supporting custom port numbers soon.)  Shortly after
running the command, you should see `Server is listening on port 8080`
printed to the terminal, indicating that the servers are ready to go.

The next step is to set your system/browser to use the proxy server at
IP address `127.0.0.1` (localhost), port `8501`.  Updating the proxy
settings varies by operating system and possibly by browser.  On Mac
OS X, the following commands will enable the proxy server for your
WiFi adapter:

    sudo networksetup -setwebproxy Wi-Fi 127.0.0.1 8501 off
    # for HTTPS
    sudo networksetup -setsecurewebproxy Wi-Fi 127.0.0.1 8501 off

Once the proxy settings are correct, open the desired URL in your
browser, and then exercise the app.  To detect issues like leaks, it
is best to repeatedly perform a set of interactions, such that all
temporary state should be cleaned up after the interactions.  Note
that MemInsight does not support navigating between multiple pages in
a web app; all interactions must occur on a single page.  When you are
done exercising the application, press `Alt+Shift+T` in the browser
window.  You will see an alert in the browser window when trace
generation is complete.  At this point, MemInsight's lifetime analysis
may still be running.  You'll know the analysis is complete when you
see the following output in the terminal:
```
completing lifetime analysis...done writing log
done
run of script complete
```

At this point, you can disable the proxy server in your settings.  The
following commands will disable the proxy server on Mac OS X:

    sudo networksetup -setwebproxystate Wi-Fi off
    sudo networksetup -setsecurewebproxystate Wi-Fi off

Now you can move on to [inspecting the results](#inspecting-results).

### Offline Instrumentation


MemInsight can only do offline instrumentation of web
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

After instrumentation, the instrumented app must be run to collect a
trace.  We assume the instrumented app is in `/tmp/app`.

#### Web apps

To exercise an instrumented web application, run the following
command:

    ./bin/meminsight run /tmp/app

This will start a webserver running at `http://localhost:8888`.  Open
this URL in your browser to load the application, and then exercise
it.  To detect issues like leaks, it is best to repeatedly perform a
set of interactions, such that all temporary state should be cleaned
up after the interactions.  When you are done exercising the
application, press `Alt+Shift+T` in the browser window.  You will see
an alert in the browser window when trace generation is complete.  In
the terminal, you will see output like the following:

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

#### node.js apps

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

(For online instrumentation, pass the path to the original node.js app
or the output path passed to the `meminsight proxy` command.)  Then,
open `http://localhost:9000` in your browser to view the GUI.

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
