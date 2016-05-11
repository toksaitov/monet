monet
=====

![Architecture](http://i.imgur.com/JLtDjC5.png)

monet is a distributed image generation system for the
[neural-doodle](https://github.com/alexjc/neural-doodle) project.

monet uses a task queue and publish/subscribe messaging to scale its workers'
pool across a cluster.

monet provides an HTTP API to get a list of installed artworks, add new tasks to
the queue, query progress, and get intermediate or final results.

# Services

* API Endpoint
    * [monet-api](https://github.com/toksaitov/monet-api)
* Task Runner
    * [monet-agent](https://github.com/toksaitov/monet-agent)
* [Nerual-Doodle](https://github.com/alexjc/neural-doodle) Docker Container Images
    * [neural-doodle-cpu](https://github.com/toksaitov/neural-doodle-cpu)
    * [neural-doodle-gpu](https://github.com/toksaitov/neural-doodle-gpu)

## Containerization

* `docker-compose build`: to build all *monet* images

* `docker-compose up`: to start the service

* `docker-compose down`: to stop the service

* `docker-compose -f docker-compose-gpu.yml <all the commands above>`: to work
  with the GPU variant of *neural-doodle*

Project directories from the host machine are mounted under source directories
inside containers to allow instant source changes throughout development without
rebuilds.

## Licensing

*monet* is licensed under the MIT license. See LICENSE for the full license
text.

## Credits

*Neural Doodle* is developed by [Alex J. Champandard](https://github.com/alexjc).

*monet* was created by [Dmitrii Toksaitov](https://github.com/toksaitov).
