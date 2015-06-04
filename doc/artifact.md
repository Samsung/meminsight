MemInsight Artifact
===================

This page documents how to reproduce the results described in the
ESEC/FSE 2015 paper "MemInsight: Platform-Independent Memory Debugging
for JavaScript."  The artifact is specifically designed to help
reproduce the results described in the Case Studies and Evaluation of
Implementation sections of the paper.  It can also be used to test out
MemInsight on other applications.

Note that the artifact is meant to be consistent with
[this version of our paper](https://github.com/Samsung/meminsight/raw/master/doc/meminsight-extended.pdf),
which includes some minor changes made since the submission.


Installation
------------

Our virtual machine is available [here](https://www.dropbox.com/s/ae4plyvxz1dmvjw/meminsight.ova?dl=0) (3.1GB, md5 `95faa3c7f7b2dcd57071afd508e02eef`).  Here is some
information about the machine:

* username / password: vagrant / vagrant (due to use of [Vagrant](https://www.vagrantup.com).  This user can run sudo commands without a password)
* RAM: 2048MB

When booted up, a Terminal will be opened in the `vagrant` home directory.  The directory structure under this home directory is:
* `meminsight`: the MemInsight tool itself
* `apps`: Applications used for our case studies (further details below)
* `octane-node`: Octane benchmarks, used for evaluating the overhead of MemInsight

Since the VM itself requires 2GB RAM, we recommend running it on a machine with at least 8GB RAM, though it may run elsewhere.  Also, note that the VM is configured to only use one CPU.  Better performance can be achieved by running on a multicore, as the lifetime analysis will run concurrently with instrumented web applications.

To install MemInsight directly on a machine, follow the instructions [in the README](/README.md).  Note that after cloning the repository and before installing dependencies, you must check out the `AEC` branch to have code consistent with what is in the virtual machine (the `master` branch has evolved significantly since the paper submission).  You can then copy out the `apps` and `octane-node` directories from the virtual machine if you'd like to reproduce our results as described below.

Case Studies
------------

As MemInsight is a dynamic analysis, using MemInsight requires instrumenting and exercising appropriate scenarios in each desired application.  To ease inspection of our results, our VM includes a copy of each case study application that has already been instrumented and exercised, such that the MemInsight results are ready for inspection.  Opening these saved results is the easiest way to explore our case study results (along with exploring the source code of the apps as desired).  If desired, the apps can also be instrumented and exercised from scratch.  We provide high-level descriptions of how we exercised each app below, but results may vary depending on specific details of how each app is exercised.

The `apps` directory for our case studies has the following structure:

* The `original/` sub-directory holds the original code for each application.  For cases where a memory-related issue was fixed, the application code after the fix is stored in a directory with suffix `-FIXED/`
* The `instrumented/` sub-directory contains the instrumented versions of each application with the saved MemInsight results from our exercising of the app.

To view the MemInsight result for an app we have already instrumented and exercised, simply run the `meminsight inspect` command from the `meminsight` directory, passing the instrumented app directory.  E.g., for the app `jquery-leak-handler`, here is the command and console output:

```
vagrant@vagrant:~/meminsight$ ./bin/meminsight inspect ~/apps/instrumented/jquery-handler-leak
inspecting previous run of app /home/vagrant/apps/instrumented/jquery-handler-leak
Input file is: /home/vagrant/apps/instrumented/jquery-handler-leak/enhanced-trace
Reading Size and Staleness JSON file /home/vagrant/apps/instrumented/jquery-handler-leak/staleness.json
Serving on port 9000. Use Ctrl-C to close
readJSON: 98ms
Populating JSON objects
...done
Populating function trace
... done
parse: 34ms
finished processing enhanced trace
```

Once you have run this command, open the Chromium browser via the desktop shortcut, and click on the MemInsight bookmark to load the GUI.  (The Chromium desktop shortcut must be used, or otherwise mouse hover events do not work in the VM.) Please read the documentation for the GUI [in the README](/README.md#inspecting-results) to understand what it shows and how to navigate it.  Note that in the GUI, all the source file names will include `_orig_` (e.g., `main_orig_.js`); this is done to distinguish from the instrumented versions of the files.  When you are done inspecting the results for the app, you can kill the command in the terminal by pressing `CTRL+C`.


If you would like to exercise the applications yourself, we recommend instrumenting them from scratch, since this way the MemInsight traces we have already created will be preserved.  You can do so by following the instructions for instrumentation [in the README](/README.md#instrumentation) for apps in the `apps/original` directory; by default, the instrumented version will be written to `/tmp`.  When a non-standard instrumentation command is required, we document it below.

In the remainder of this section, we describe each case study app, how we exercised it, and how to observe the results described in the paper.  We first describe the jquery-handler-leak app discussed in the paper introduction, and then discuss each of the case study apps from Section 5 in order.

### jquery-handler-leak

Open the jquery-handler-leak results by running:

    ./bin/meminsight inspect ~/apps/instrumented/jquery-handler-leak

This is a small app that we wrote to illustrate a jQuery-related memory leak, described in the first section of the paper.  To exercise the app, we repeated clicking the `Add` button several times followed by clicking `Remove All` several times.  In the GUI, when the issue table is sorted by Leak, the function object allocated at line 4 of `scr_orig_.js` appears at the top; opening the Alocation Site View for this site (by clicking on the link in the Site column) clearly shows increasing stale objects in the Timeline View.  You can view the results with the leak fixed as follows:

    ./bin/meminsight inspect ~/apps/instrumented/jquery-handler-leak-FIXED

The results show that the leak is eliminated after the fix.

### shopping list

Open the shopping list results by running:

    ./bin/meminsight inspect ~/apps/instrumented/shopping-list

We exercised the app by adding five lists and then clicking on the list names repeatedly.  When sorted by Leak, the GUI shows a large leak at line 4390 in jQuery.  In the allocation site view, the call tree shows that many of the objects were allocated by line 939 of `js/main_orig_.js`, which attaches event handlers.  The fixed version of the app eliminates this leak, as can be observed by viewing the results:

    ./bin/meminsight inspect ~/apps/instrumented/shopping-list-FIXED

### annex

Open the annex results by running:

    ./bin/meminsight inspect ~/apps/instrumented/annex

We exercised annex by playing three moves against the computer.  In the All-Sites Timeline view for annex, note that the peak object count is above 10000 nodes.  The annex-FIXED app includes a fix for the first issue described in the paper (the excessive drag issue).  Open the results for the fixed app:

    ./bin/meminsight inspect ~/apps/instrumented/annex-FIXED

In the All-Sites Timeline after the fix, the peak object count is much lower, around 3500 objects.

### dataTables-test

Open the dataTables-test results by running:

    ./bin/meminsight inspect ~/apps/instrumented/dataTables-test

We exercised the app by loading a table, clicking the `Next` button to navigate through all pages, and then destroying the table, repeating the process five times.  The leaking DOM nodes of interest are allocated at line 1489 of the dataTables script, and can be found in the Issue Table in the GUI by typing '1489' into the search box.  (Note that this site does not have a non-zero value in the Leak column of the Issue Table.  The reason is that while some objects leak from the site, the number of leaked objects does not grow over time, whereas our computation of "leakiness" looks for a more significantly increasing stale object count.)  Opening this site in the Allocation Site View, the timeline shows that the number of live objects from the site never dips below around 120, with many of the objects being stale.  Now, open the results for the fixed version:

    ./bin/meminsight inspect ~/apps/instrumented/dataTables-test-FIXED

When showing the Allocation Site View for the same site, the timeline clearly shows the number of live objects going back down to zero, as desired.

### esprima

esprima was tested as a node.js library.  To instrument esprima, we used the following command, to ensure that only esprima was instrumented and not third-party library code:

    ./bin/meminsight instrument --outputDir ~/apps/instrumented --only_include esprima.js ~/apps/original/esprima

We exercised esprima by running it on a small input JavaScript program, with the following command:

    ./bin/meminsight noderun ~/apps/instrumented/esprima/bin/esparse.js --loc --range ~/apps/original/escodegen/test/3rdparty/jslex.js

You can open up the result with this command:

    ./bin/meminsight inspect ~/apps/instrumented/esprima

(Note that due to the trace size, the results may take a few seconds to load in the GUI.)  Sorting the Issue Table by the Inline-able column, one sees high "inline-ability" for allocations at lines 683 and 639.  Clicking on the value in the Inline-able column shows the allocation site of the object into which inlining can be performed.  The results for after this inlining transformation was performed (by the Esprima developers) can be viewed with:

    ./bin/meminsight inspect ~/apps/instrumented/esprima-FIXED

### escodegen

escodegen was tested as a node.js library.  To instrument escodegen, we used the following command, to ensure that only escodegen was instrumented and not third-party library code:

    ./bin/meminsight instrument --outputDir ~/apps/instrumented --only_include escodegen.js ~/apps/original/escodegen

We exercised esprima by running it on a small input JavaScript program, with the following command:

    ./bin/meminsight noderun ~/apps/instrumented/escodegen/bin/escodegen.js ~/apps/original/escodegen/test/3rdparty/jslex.js

The result can be opened with:

    ./bin/meminsight inspect ~/apps/instrumented/escodegen

(Note that due to the trace size, the results may take a few seconds to load in the GUI.)  When sorting the Issue Table by Occupancy, the top site is on line 564, corresponding to allocation of `SourceNodeMock` objects (the `SourceNode` identifier is bound to the `SourceNodeMock` function).  The Allocation Site view shows most of these objects are not stale during execution, indicating that the change to remove these allocations may be non-trivial.  Also note that in the All-Sites Timeline view, the peak heap footprint is over 5500 objects.  The results after our fix can be viewed with:

    ./bin/meminsight inspect ~/apps/instrumented/escodegen-FIXED

Note that in these results, the peak footprint observed in the All-Sites Timeline is down to around 180 objects.

Overhead and DOM Handling
-------------------------

Our script for measuring MemInsight overhead on Octane benchmarks is `drivers/benchmarkDriver.js`.  To run it on all Octane benchmarks, run this command:

    node drivers/benchmarkDriver.js --outputDir ~/octane-out ~/octane-node

Note that overhead may vary when running in the VM as compared to running on raw hardware.  Also, for larger benchmarks like TypeScript, the lifetime analysis may run very slowly or run out of memory in the VM, due to the 2GB limit.  For more accurate numbers, we recommend running this script on bare hardware rather than in a VM.

The DOM node measurements in Table 1 were collected in a number of steps:

* The numbers in the "model" column are printed in an alert dialog in the browser, after exercising the app.
* The numbers in the "init", "unknown", and "det" columns were obtained by simple post-processing on the `staleness.json` file produced by the lifetime analysis using `grep`.  E.g., for "det", we ran the command `grep -o "removed from DOM" staleness.json | wc -l`.
* The numbers in the "base" column were obtained by subtracting the "model", "init", and "unknown" column values from the total number of DOM nodes.

We did not preserve the exact traces used to generate the numbers in Table 1.  But, we confirmed that when exercising the apps again, the numbers were similar.

Running on Other Apps
=====================

MemInsight can easily be run on other applications, following the instructions [in the README](/README.md).  Note that very long executions may cause an out-of-memory error in the `AEC` branch, either in the lifetime analysis or in the GUI code.  We are in the process of improving scalability on the `master` branch.  We welcome reports of any bugs on the [issue tracker](https://github.com/Samsung/meminsight/issues) (to preserve reviewer anonymity, a throwaway GitHub account could be created).






