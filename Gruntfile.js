/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global module, require */

module.exports = function (grunt) {
  
    'use strict';
  
    require('load-grunt-tasks')(grunt);
   
    var pkg = grunt.file.readJSON("package.json");

    grunt.initConfig({
        
        // configurable paths
        yeoman: {
            src: './',
            lib: 'lib/'
        },
        
        watch: {
            files: ['<%= yeoman.src %>/{,*/}*.js'],
            tasks: ['jshint']
        },
        
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all: [
                '<%= yeoman.src %>/*.js'
            ]
        }
        
    });
    
    grunt.registerTask('default', ['jshint']); 
};
