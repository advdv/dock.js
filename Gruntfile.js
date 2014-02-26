module.exports = function(grunt){
  'use strict';
  
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      unitTests: {
        files: ['index.js', 'lib/*.js', 'test/*_test.js', 'test/stubs/*.js'],
        tasks: ['shell:unitTests'],
      },
    },

    shell: {
      unitTests: {
        options: {
          stdout: true,
          stderr: true
        },
        command: './node_modules/.bin/mocha ./test/*_test.js --require should -t 10000'
      }
    }
  });

  grunt.registerTask('start', ['watch:unitTests']);
  grunt.registerTask('default', ['start']);
  grunt.registerTask('test', ['shell:unitTests']);

};