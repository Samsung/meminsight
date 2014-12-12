# Overview

Profiling a web application with MemInsight is a three step
process. First the application must be instrumented. In addition to
its normal functionality an instrumented app will generate a *trace*
of its actions which is used for analysis later on. To actually
generate such a trace the application must be excercised by the
developer. For the analysis results to be useful, the trace must
represent a realistic interaction with the application.

# Installation

## Requirements

* [Java 8](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html) 
* [Gradle](http://www.gradle.org/installation)
* [nodejs](http://www.nodejs.org)

## Building from source

### Cloning and building memory-trace
*This currently requires access to SRA internal network*

- Clone memory-trace: https://stash.sisa.samsung.com:8443/projects/ASPLMA/repos/memory-trace/browse

- Inside memory-trace, do 'npm install'.  NOTE: this will download a fresh copy of jalangi under node_modules.  If you want to use an existing copy, before running 'npm install', first do 'mkdir node_modules' and then 'cd node_modules; ln -s path/to/existing/jalangi'.  

- Inside memory-trace, run './node_modules/.bin/grunt' to compile the TypeScript code.

###Cloning and building memory-analysis-v2

- Clone memory-analysis-v2: https://stash.sisa.samsung.com:8443/projects/ASPLMA/repos/memory-analysis-v2/browse 

NOTE: memory-analysis-v2 repository must be a sibling directory of memory-trace.

- Inside memory-analysis-v2, run 'gradle fatJar' to compile the Java code (this may take a while the first time, as it will download dependencies).

## Example Programs

The distribution includes N examples programs. We will use an annex as
an example in this documentation.

## Instrumenting

Inside memory-trace, run:

node drivers/memTraceDriver.js --justGenerate --verbose --outputDir /tmp path/to/app

This will create a directory /tmp/app with the instrumented code and
auxilliary data.

## Exercising an app and viewing the GUI

- Inside memory-trace, run:

node lib/server/server.js path/to/instrumented/app

E.g., if you instrumented as above, you'd run:

node lib/server/server.js /tmp/app

This serves up the app at http://localhost:8888.

- Exercise the app by visiting http://localhost:8888.  When done, press Alt-Shift-T to complete the tracing.  Then, close the app.

- When the GUI is ready, you'll see the message "Showing the results on http://localhost:9000/" in the terminal where you started the server.  Then, go to http://localhost:9000 to view the GUI output.
