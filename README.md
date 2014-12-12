MemInsight
==========

MemInsight is a memory profiler for web applications.

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


Usage
-----

To instrument an app in directory `path/to/app`:

    ./bin/meminsight instrument path/to/app

To then exercise that app and collect profiling results:

    ./bin/meminsight run /tmp/app

And to show the results in our GUI:

    ./bin/meminsight inspect /tmp/app

License
-------

MemInsight is distributed under the
[Apache License](http://www.apache.org/licenses/LICENSE-2.0.html).
