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
module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-exec');
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        typescript: {
            tscode: {
                src: ['lib/gui/*.ts', 'lib/newGUI/*.ts', 'lib/server/*.ts', 'test/*.ts', 'drivers/*.ts',
                    'lib/analysis/memAnalysisUtils.ts'],
                dest: './',
                options: {
                    module: 'commonjs',
                    target: 'es5',
                    sourceMap: true,
                    declaration: false
                }
            },
            analysis: {
                src: ['lib/analysis/LoggingAnalysis.ts'],
                dest: 'bin/LoggingAnalysis.js',
                options: {
                    target: 'es5',
                    sourceMap: true
                }
            }
        },
        exec: {
            build_lifetime: 'cd lifetime-analysis; gradle installApp; cd ..'
        }
    });
    grunt.registerTask('default', ['typescript','exec']);
};
