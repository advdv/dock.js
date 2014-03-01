var arg = require('args-js');
var path = require('path');
var temp = require('temp');
var fs = require('fs');
var crypto = require('crypto');
var archiver = require('archiver');
var winston = require('winston');
var Promise = require('bluebird');

/**
 * Represents an docker image with its assocaiated context
 *
 * @param {Object} docker  the "dockerode" instance
 * @param {String} contextDir directory in which the docker file resided
 * @param {Object} [options] additional options
 */
var Image = function(){
  'use strict';
  var self = this;
  var args = arg([
    {docker:       arg.OBJECT | arg.Required},
    {contextDir:       arg.STRING | arg.Required},
    {imageTag:       arg.STRING | arg.Required},
    {buildConf:       arg.OBJECT | arg.Optional, _default: {}},
    {archiver:       arg.FUNCTION | arg.Optional, _default: archiver},
    {logger:         arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
    {options:       arg.OBJECT | arg.Optional, _default: {
      dockerFileName: 'Dockerfile'
    }},
  ], arguments);

  self.docker = args.docker;
  self.logger = args.logger;
  self.options = args.options;
  self.buildConf = args.buildConf;
  self.contextDir = path.resolve(args.contextDir);
  self.archiver = args.archiver;
  self.imageTag = args.imageTag;
  
  self.tarFile = false;
  self.tarred = false;
  self.built = false;
  self.id = false;



  /**
   * Parse build progress of this image
   * 
   * @param  {String} chunk the raw result
   * @return {[type]}       [description]
   */
  self.parseStatus = function(chunk) {
    var step = JSON.parse(chunk);
    if (step.error) {
      throw new Error(step.error);
    }

    var match = step.stream.match(/Successfully built ([a-z0-9]+)/);
    if(match !== null) {
      self.id = match[1];
      self.logger.info('[%s] build complete! (%s)', self.imageTag, self.id);
    } else {
      self.logger.info('  ' + step.stream.replace(/(\n|\r|\r\n)$/, ''));
    }
  };

  /**
   * Remove temporary files
   * 
   * @return {Promise} promise that completes temporary files are removed
   */
  self.cleanUp = function cleanUp() {
    return new Promise(function(resolve, reject){
      fs.unlink(self.tarFile, function(err){
        if(err) {
          reject(err);
        }

        self.logger.info('[%s] cleanup done!', self.imageTag);
        resolve();
      });
    });
  };

  /**
   * Build the image using the tarred context
   *   
   * @return {Promise} promise that resolves when the image is build
   */
  self.build = function build() {
    if(self.built !== false) {
      return self.built;
    }

    self.built = self.tar().then(function(tarFile){
        
      //set imageTag as buildconf t
      self.buildConf.t = self.imageTag;

      self.logger.info('[%s] starting build....', self.imageTag);

      return new Promise(function(resolve, reject){        
        self.docker.buildImage(tarFile, self.buildConf, function(err, response){
          if(err) {
            reject(err);
          }

          //handle progress
          response.on('data', function(chunk){
            try {
              self.parseStatus(chunk);  
            } catch(e) {
              reject(e);
            }
          });

          //handle end of build
          response.on('end', function () {
            if(self.id === false) {
              reject(new Error('Could not retrieve image id from build'));
            }

            resolve(self.id);
          });
        });

      });
    }).finally(self.cleanUp);

    return self.built;
  };

  /**
   * Create a tar file in atemporary directory from the dockerFile and its context
   * 
   * @return {Promise} promise that resolves when the tar is created
   */
  self.tar = function tar() {
    if(self.tarred !== false)
      return self.tarred;

    self.logger.info('[%s] tarring context....', self.imageTag);
    self.tarred = new Promise(function(resolve, reject){
      var path = self.contextDir + '/'+self.options.dockerFileName;
      var dockerFile = fs.createReadStream(path);  
      var hasher = crypto.createHash('sha1');

      dockerFile.pipe(hasher, {end: false});
      dockerFile.on('error', function(err){
        reject(err);
        return;
      });

      //when dockerfile is read, create hash
      dockerFile.on('end', function() {
        var hash = hasher.digest('hex');
        temp.mkdir('Dockjs', function(err, tmpDir){
          if(err){
            reject(err);
            return;
          }

          //use the hash to create a write stream in tmp
          var path = tmpDir + '/' + hash + '.tar';
          var output = fs.createWriteStream(path);
          var archive = self.archiver('tar');

          output.on('close', function () {
            self.tarFile = path;
            resolve(path);
          });

          archive.on('error', function (err) {
            reject(err);
          });

          //pipe archive into tmp file
          archive.pipe(output);
          archive.bulk([
            { expand: true, cwd: self.contextDir, src: ['**'] },
          ]);

          //gogo archive
          archive.finalize();
        });
      });
    });

    return self.tarred;
  };

  return self;
};

module.exports = Image;