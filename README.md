Dock.js
=======

[![Build Status](https://travis-ci.org/advanderveer/dock.js.png)](https://travis-ci.org/advanderveer/dock.js)
[![Dependency Status](https://david-dm.org/advanderveer/dock.js.png)](https://david-dm.org/advanderveer/dock.js)
[![NPM version](https://badge.fury.io/js/dock.js.png)](http://badge.fury.io/js/dock.js)

An easy-to-use Promise based Node.js module that supports your [Docker](http://www.docker.io) setup. It provides a high-level API that makes building images and bootstrapping containers using JavaScript quick and painless. _You can  finally leave those messy bash scripts behind!_

We aim to keep a minimal feature set and instead focus on stability and usability, something more extensive — such as JSON configuration and a dedicated command line interface — is offered by [decking](http://decking.io/)

Quick start
----------
Dock.js is currently only available for Node.js and as such can be installed easily using NPM:

```Shell
npm install dock.js
```

Now you can simply require Dock.js on top of your script: 

```JavaScript
var Dock = require('dock.js');
```

Todos
------
This library is still in early development

-   create getLink() method on dock that returns precise container name by service name
-   implement Processes.isCreatedEqual()
-   pipe process stdin to container, so process and container can be killed using ctrl-c?
-  	unexpected single char prefixing piping container output e.g  "~2014-03-07 10:58:16 UTC LOG:  received sm.."
-   Port already taken errors not showing
-   Stopping services
-   Complete documentation (obviously)

License
-------
Ad van der Veer

Licensed under the Apache license, version 2.0 (the "license"); You may not use this file except in compliance with the license. You may obtain a copy of the license at:

http://www.apache.org/licenses/LICENSE-2.0.html
Unless required by applicable law or agreed to in writing, software distributed under the license is distributed on an "as is" basis, without warranties or conditions of any kind, either express or implied. See the license for the specific language governing permissions and limitations under the license.