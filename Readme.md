neural-doodle-cpu
=================

Here you can find a Docker container image for the project [Neural
Doodle](https://github.com/alexjc/neural-doodle).

This is a container image for rendering on a CPU. A variant of the container to
render on a GPU can be found [here](http://github.com/toksaitov/neural-doodle-gpu).

## Prerequisites

### Software

* *Ubuntu* `>= 14.04`
* *Docker* `>= 1.9`

## Usage

To install Docker Engine with Docker Compose on Ubuntu `>= 14.04`

    sudo ./install-docker-with-compose-ubuntu.sh

Re-login after installation.

To get an image from Docker Hub

    docker pull toksaitov/neural-doodle:cpu

To build the image

    docker build --tag=toksaitov/neural-doodle:cpu .

or with Docker Compose

    docker-compose build

To start the container with an STDIN open and an allocated pseudo-TTY, with a
volume `/data` inside the container mounted under `./data` on a host

    docker run --interactive --tty --volume="$(pwd)/data":/data/ toksaitov/neural-doodle:cpu <neural-doodle arguments>

or with Docker Compose

    docker-compose run neural-doodle <neural-doodle arguments>

To start with an interactive shell inside the container

    docker run --interactive --tty --volume="$(pwd)/data":/data/ --entrypoint=bash toksaitov/neural-doodle:cpu

## Docker Hub

[toksaitov/neural-doodle](https://hub.docker.com/r/toksaitov/neural-doodle)

## Credits

*Neural Doodle* is developed by [Alex J. Champandard](https://github.com/alexjc).

The Docker image was created by [Dmitrii Toksaitov](https://github.com/toksaitov).
