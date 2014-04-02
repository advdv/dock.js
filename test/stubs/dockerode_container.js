/* globals setTimeout */
var crypto = require('crypto');
var arg = require('args-js');

module.exports = function stubDockerodeContainer() {
  'use strict';
  var self = this;
  var args = arg([
    {id:       arg.STRING | arg.Optional, _default: crypto.randomBytes(20).toString('hex')},
  ], arguments);
  
  self.id = args.id;

  self.attach = function(conf, cb) {

    cb(false, {
      on: function(){},
      pipe: function(){}
    });
  };

  self.stop = function(conf, cb) {
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*20)+1));
  };

  self.remove = function(cb) {
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*20)+1));
  };

  self.start = function(conf, cb) {
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*20)+1));
  };

  self.inspect = function(cb) {
    setTimeout(function(){
      if(self.id === '2abddfe551decfde0018adbce7efd0bb3213846f34517b5cc8d35a7d2baf8643') {


      var info = {
          "ID": "2abddfe551decfde0018adbce7efd0bb3213846f34517b5cc8d35a7d2baf8643",
          "Created": "2014-04-01T14:22:04.967717557Z",
          "Path": "/usr/lib/postgresql/9.3/bin/postgres",
          "Args": [
              "-D",
              "/etc/postgresql/9.3/main"
          ],
          "Config": {
              "Hostname": "2abddfe551de",
              "Domainname": "",
              "User": "postgres",
              "Memory": 0,
              "MemorySwap": 0,
              "CpuShares": 0,
              "AttachStdin": false,
              "AttachStdout": false,
              "AttachStderr": false,
              "PortSpecs": null,
              "ExposedPorts": {
                  "5432/tcp": {}
              },
              "Tty": false,
              "OpenStdin": false,
              "StdinOnce": false,
              "Env": [
                  "HOME=/",
                  "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                  "DB_USER=wkmb"
              ],
              "Cmd": [
                  "/usr/lib/postgresql/9.3/bin/postgres",
                  "-D",
                  "/etc/postgresql/9.3/main"
              ],
              "Dns": null,
              "Image": "stepshape/wkmb/pgsql",
              "Volumes": {
                  "['/data']": {}
              },
              "VolumesFrom": "",
              "WorkingDir": "",
              "Entrypoint": null,
              "NetworkDisabled": false,
              "OnBuild": null
          },
          "State": {
              "Running": true,
              "Pid": 5057,
              "ExitCode": 0,
              "StartedAt": "2014-04-01T14:22:05.745450584Z",
              "FinishedAt": "0001-01-01T00:00:00Z",
              "Ghost": false
          },
          "Image": "927db360f8ff21a29d0b0250f602a38a78f16caee3ef858b4c80510409d75ff9",
          "NetworkSettings": {
              "IPAddress": "172.17.0.3",
              "IPPrefixLen": 16,
              "Gateway": "172.17.42.1",
              "Bridge": "docker0",
              "PortMapping": null,
              "Ports": {
                  "5432/tcp": [
                      {
                          "HostIp": "0.0.0.0",
                          "HostPort": "5432"
                      }
                  ]
              }
          },
          "ResolvConfPath": "/etc/resolv.conf",
          "HostnamePath": "/var/lib/docker/containers/2abddfe551decfde0018adbce7efd0bb3213846f34517b5cc8d35a7d2baf8643/hostname",
          "HostsPath": "/var/lib/docker/containers/2abddfe551decfde0018adbce7efd0bb3213846f34517b5cc8d35a7d2baf8643/hosts",
          "Name": "/wkmb-sql_0",
          "Driver": "aufs",
          "Volumes": {
              "['/data']": "/var/lib/docker/vfs/dir/ccdbd4d74db4ce01ddba9875551d6107a44797b6439417dc36a3cc7e7b34bdc2"
          },
          "VolumesRW": {
              "['/data']": true
          },
          "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LxcConf": null,
            "Privileged": false,
            "PortBindings": {
                "5432/tcp": [
                    {
                        "HostIp": "0.0.0.0",
                        "HostPort": "5432"
                    }
                ]
            },
            "Links": null,
            "PublishAllPorts": false
          }
        }

        cb(false, info);

      }


      cb(false, {
        "NetworkSettings": {
          "IpAddress": "",
          "IpPrefixLen": 0,
          "Gateway": "",
          "Bridge": "",
          "PortMapping": null
        },
      });
    },Math.floor((Math.random()*20)+1));
  };

  return self;
};
