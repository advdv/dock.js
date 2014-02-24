module.exports = function(grunt){
  'use strict';
  
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      unitTests: {
        files: ['lib/*.js', 'test/*_test.js', 'test/stubs/*.js'],
        tasks: ['shell:unitTests'],
      },
    },

    shell: {
      unitTests: {
        options: {
          stdout: true,
          stderr: true
        },
        command: './node_modules/.bin/mocha ./test/*_test.js --require should'
      }
    }
  });

  grunt.registerTask('default', ['watch:unitTests']);
  grunt.registerTask('test', ['shell:unitTests']);

};