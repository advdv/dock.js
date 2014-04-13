var arg = require('args-js');
var path = require('path');
var temp = require('temp');
var fs = require('fs');
var crypto = require('crypto');
var child_process = require("child_process");
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

  //clone the argspect for each instance
  var args = arg([
    {docker:       arg.OBJECT   | arg.Required},
    {contextDir:   arg.STRING   | arg.Required},
    {imageTag:     arg.STRING   | arg.Required},    
    {buildConf:    arg.OBJECT   | arg.Optional, _default: {}},    
    {pushConf:     arg.OBJECT   | arg.Optional, _default: {}},    
    {from:         arg.ANY      | arg.Optional, _default: false},  
    {logger:       arg.OBJECT   | arg.Optional, _default: new winston.Logger(), _type: winston.Logger},
    {options:      arg.OBJECT   | arg.Optional, _default: {
      dockerFileName: 'Dockerfile',
      dockerFileEncodig: 'utf8',
      tarBin: 'tar',
      tarOperations: '-cjf',
      successMatcher: /Successfully built ([a-z0-9]+)/,
      pushAuth: {}
    }},
  ], arguments);

  self.docker = args.docker;
  self.logger = args.logger;
  self.options = args.options;
  self.buildConf = args.buildConf;
  self.pushConf = args.pushConf;
  self.contextDir = path.resolve(args.contextDir);
  self.imageTag = Image.normalizeTag(args.imageTag);
  var tparts = self.imageTag.split(':');
  self.imageVersion = tparts.pop();
  self.imageName = tparts.join(':');
  
  self.tarFile = false;
  self.pushing = false;
  self.tagging = false;
  self.tarred = false;
  self.built = false;
  self.id = false;

  var _from = false;

  /**
   * Specify the image from which this image extends
   *
   * 
   * @return {Self} this image
   */
  self.extend = function extend(image) {
    var img = image;

    //not already a promise? lets normalize
    if(!(image instanceof Promise)) {

      //promise should always resolve to a bound function
      if(!(image instanceof Function)) {
        if(!(image instanceof Image)) {
          if(image === false) {
            //image is probably specifically not set; provide default value
            img = function(){ return false; };
          } else {
            throw new Error('Expected Image instance during extending, received: "'+image+'"');  
          }
        }

        img = function(){ return image; };
      }

      img = Promise.cast(img);
    }

    _from = img;
    return self;
  };

  /**
   * Parse build progress of this image
   * 
   * @param  {Buffer} chunk the raw result
   */
  self.parseBuildStatus = function(chunk) {
    var step = JSON.parse(chunk);
    if (step.error) {
      throw new Error('Docker build returned error: ' + JSON.stringify(step));
    } else if(step.status) {
      if(step.status === 'Downloading') {
        return; //skip downloading progress spam
      } else {
        self.logger.info('  ' + step.status.replace(/(\n|\r|\r\n)$/, ''));  
      }
    } else if(step.stream) {
      var match = step.stream.match(self.options.successMatcher);
      if(match !== null) {
        self.id = match[1];
        self.logger.info('[%s] build complete! (%s)', self.imageTag, self.id);
      } else {
        self.logger.info('  ' + step.stream.replace(/(\n|\r|\r\n)$/, ''));
      }
    } else {
      throw new Error('Unexpected build status, received:' + chunk);
    }

  };

  /**
   * Parse push progress of this image
   * @param  {Buffer} chunk the data
   */
  self.parsePushStatus = function(chunk) {
    var s = JSON.parse(chunk);
    if (s.error) {
      throw new Error('Docker build returned error: ' + JSON.stringify(s));
    } else if(s.status) {
      if(s.status === 'Pushing' && s.progress) {
        self.logger.info('  ' + s.progress);  
      } else {
        self.logger.info('  ' + s.status.replace(/(\n|\r|\r\n)$/, ''));  
      }
    } else {
      throw new Error('Unexpected push status, received:' + chunk.toString());
    }
  };


  /**
   * Remove temporary files
   * 
   * @return {Promise} promise that completes temporary files are removed
   */
  self.cleanUp = function cleanUp() {  
    //if there is never a tar file created just return
    if(self.tarFile === false) {
      return;
    }

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
   * Push the image to the repository
   * @return {Promise} prommise that completes when the push is done
   */
  self.push = function push() {

    if(self.pushing !== false) {
      return self.pushing;
    }

    self.logger.info('[%s] pushing image...', self.imageTag);
    self.pushing = new Promise(function(resolve, reject){
      var img = self.docker.getImage(self.imageName);
      img.push(self.pushConf, function(err, data){
        if(err) {
          reject(err);
          return;
        }

        data.on('data', function(chunk){
          try {
            self.parsePushStatus(chunk);  
          } catch(e) {
            reject(e);
          }
        });

        data.on('end', function(){
          resolve();
        });

      }, self.options.pushAuth);
    }).finally(function(){
      self.pushing = false;
    });

    return self.pushing;
  };

  /**
   * Tag an image 
   * @return {Promise} that completes when the tagging is complete
   */
  self.tag = function tag(imageTag) {
    if(self.tagging !== false) {
      return self.tagging;
    }

    var conf = {
      repo: imageTag
    };

    self.logger.info('[%s] tagging image...', self.imageTag);
    self.tagging = new Promise(function(resolve, reject){
      var img = self.docker.getImage(self.imageTag);
      img.tag(conf, function(err){
        if(err) {
          reject(err);
          return;
        }

        resolve();
      });
    }).finally(function(){
      self.tagging = false;
    });

    return self.tagging;
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

    //from is always a promise
    self.built = _from
                    .then(function(dep){                       

                      //if parent turns out to be an image, build it else return promise that completes directly
                      return (dep() instanceof Image) ? dep().build() : Promise.cast(false); 
                      
                    })
                    .then(self.tar)
                    .then(function(tarFile){

      //set imageTag as buildconf t
      self.buildConf.t = self.imageTag;

      self.logger.info('[%s] starting build....', self.imageTag);
      return new Promise(function(resolve, reject){        
        self.docker.buildImage(tarFile, self.buildConf, function(err, response){
          if(err) {
            reject(err);
            return;
          }

          //handle progress
          response.on('data', function(chunk){
            try {
              self.parseBuildStatus(chunk);  
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

          //spawn a child process to tar
          var path = tmpDir + '/' + hash + '.tar';
          var tar = child_process.spawn(self.options.tarBin, ['-C',self.contextDir, self.options.tarOperations, path, '.']);
          tar.on('close', function(){
            self.tarFile = path;
            resolve(path);
          });

          tar.on('error', function(err){
            reject(err);
            return;
          });

        });
      });
    });

    return self.tarred;
  };

  /**
   * Construction logic
   */
  
  //normalize from into function
  self.extend(args.from);

  Object.defineProperty(self, 'from', {
    get: function(){
      
      //@todo implement additonal checks for handling asynness
      return _from;
    }
  });

  return self;
};

/**
 * Normalize the tag into repository:tag format
 * @param  {String} imageTag input tag
 * @return {String}          output tag
 */
Image.normalizeTag = function() {
  'use strict';
  var args = arg([
    {imageTag:     arg.STRING   | arg.Required}    
  ].concat([]), arguments);

  //split between repository (before /) and name (after /)
  //if name is undefined, we have only one element (the name)
  var rep = args.imageTag.split('/')[0];
  var name = args.imageTag.split('/')[1];
  if(name === undefined) {
    name = rep;
    rep = false;
  }

  //if name has versioning split on
  //@todo this fails if the name has multipe ":" after the /
  var version = name.split(':')[1];
  name = name.split(':')[0];
  if(!version) {
    version = 'latest';
  }

  var res = name + ':' + version;
  if(rep) {
    res = rep + '/' + res;
  }

  return res;
};


module.exports = Image;