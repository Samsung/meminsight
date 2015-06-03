MemInsight Artifact
===================

This page documents how to reproduce the results described in the
ESEC/FSE 2015 paper "MemInsight: Platform-Independent Memory Debugging
for JavaScript."  The artifact is specifically designed to help
reproduce the results described in the Case Studies and Evaluation of
Implementation sections of the paper.  It can also be used to test out
MemInsight on other applications.

Note that the artifact is meant to be consistent with this version of
the paper XXXTODO

Installation
------------

Our virtual machine is available [here](TODO) (size, md5 TODO).  Here is some
information about the machine:

* username / password: vagrant / vagrant (can run sudo commands without a password)
* RAM: 2048MB
* Image size: TODO

When booted up, you'll get a terminal.  Directory structure is:
* `meminsight`: the MemInsight tool itself
* `apps`: Applications used for our case studies (further details below)
* `octane-node`: Octane benchmarks, used for evaluating the overhead of MemInsight

Since the VM itself requires 2GB RAM, we recommend running it on a machine with at least 8GB RAM, though it may run elsewhere.  Also, note that the VM is configured to only use one CPU.  Better performance can be achieved by running on a multicore, as the lifetime analysis will run concurrently with instrumented web applications.

To install MemInsight directly on a machine, follow the instructions [in the README](/README.md).  Note that after cloning the repository and before installing dependencies, you must check out the `AEC` branch to have code consistent with what is in the virtual machine (the `master` branch has evolved significantly since the paper submission).  You can then copy out the `apps` and `octane-node` directories from the virtual machine if you'd like to reproduce our results as described below.

Case Studies
------------

The `apps` directory for our case studies has the following structure:

* The `original/` sub-directory holds the original code for each application.  For cases where a memory-related issue was fixed, the application code after the fix is stored in a directory with suffix `-FIXED/`
* The `instrumented/` sub-directory contains instrumented versions of each application that we have already exercised, so MemInsight results are ready for inspection.

To view the MemInsight result for an app we have already instrumented and exercised, run the `meminsight inspect` command from the `meminsight` directory, passing the instrumented app directory.  E.g., for the app `jquery-leak-handler`, here is the command and console output:

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

Once you have run this command, open the Chromium browser via the desktop shortcut, and click on the MemInsight bookmark to load the GUI.  Please read the documentation for the GUI [in the README](/README.md#inspecting-results) to understand what it shows and how to navigate it.  When you are done inspecting the results for the app, you can kill the command in the terminal by pressing `CTRL+C`.

If you would like to exercise the applications yourself, we recommend creating another instrumented copy first, since this way the MemInsight traces we have already created will be preserved.  You can do so by following the instructions for instrumentation [in the README](/README.md#instrumentation); by default, the instrumented version will be written to `/tmp`.

Overhead and DOM Handling
-------------------------





