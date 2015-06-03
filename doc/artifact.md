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

To install MemInsight directly on a machine, follow the instructions [in the README](/README.md).  You can then copy out the `apps` and `octane-node` directories from the virtual machine if you'd like to reproduce our results as described below.

Case Studies
------------

Overhead and DOM Handling
-------------------------





