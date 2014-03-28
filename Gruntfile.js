/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global module, require */

module.exports = function (grunt) {

    'use strict';

    require('load-grunt-tasks')(grunt);

    var pkg = grunt.file.readJSON("package.json");

    grunt.initConfig({

        watch: {
            files: ['./{,*/}*.js'],
            tasks: ['jshint']
        },

        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            // lint all files, ignore the built output from https://github.com/adobe-webplatform/css-shapes-editor
            all: [
          './{,*/}*.js', '!./thirdparty/CSSShapesEditor.js'
            ]
        }

    });

    grunt.registerTask('default', ['jshint']);
};
