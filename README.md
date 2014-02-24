dock.js
=======

[![Build Status](https://travis-ci.org/advanderveer/dock.js.png)](https://travis-ci.org/advanderveer/dock.js)
[![Dependency Status](https://david-dm.org/advanderveer/dock.js.png)](https://david-dm.org/advanderveer/dock.js)
[![NPM version](https://badge.fury.io/js/dock.js.png)](http://badge.fury.io/js/dock.js)

An easy-to-use Promise based Node.js module that orchestrates Docker containers and handles interdependencies for you.

Introduction
------------

Docker has introduced an whole new way of looking at the server architecture of our applications. I won't go in full detail because a much better introduction can be found on the [docker.io website](https://www.docker.io/learn_more/). In short, individual processes are now isolated in their own container (a lightweight virtual server) making them extremely portable. As an web application might require several interdependant different processes and additional "data-only" containers are often required for persisting data launching all these containers consistently becomes a hassle very quickly. Dock.js aims to solve this by providing a fluent high-level Object-Oriented interface for the Docker Remote Api that introduces the notion of "Services" and solving dependencies between them.


