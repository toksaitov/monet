neural-doodle-gpu
=================

Here you can find a CUDA-enabled Docker container image for the project [Neural
Doodle](https://github.com/alexjc/neural-doodle).

This is a container image for rendering on a GPU. A variant of the container to
render on a CPU can be found [here](http://github.com/toksaitov/neural-doodle-cpu).

## Prerequisites

### Hardware

* *NVIDIA GPU* `> Fermi 2.1`

### Software

* *Ubuntu* `14.04`
* *Docker* `>= 1.9`
* *NVIDIA GPU drivers* `>= 352.39`
* *NVIDIA Docker* `>= 1.0.0 BETA 2`

###### Optional

* *CUDA Toolkit* `>= 7.5`

## Usage

To install NVIDIA CUDA with NVIDIA GPU drivers on Ubuntu 14.04

    sudo ./install-cuda-drivers-ubuntu-14.04.sh

Reboot the machine after installation.

To install Docker Engine with an NVIDIA Docker wrapper and setup a Docker volume
with a current version of NVIDIA GPU drivers (ensure that you have NVIDIA GPU
drivers installed on the host)

    sudo ./install-nvidia-docker-ubuntu-14.04.sh

Re-login after installation.

To setup a Docker volume with NVIDIA GPU drivers manually

    sudo nvidia-docker volume setup

To get an image from Docker Hub

    docker pull toksaitov/neural-doodle:gpu

To build the image

    docker build --tag=toksaitov/neural-doodle:gpu .

To start the container with an STDIN open and an allocated pseudo-TTY, with a
volume `/data` inside the container mounted under `./data` on a host

    nvidia-docker run --interactive --tty --volume="$(pwd)/data":/data/ toksaitov/neural-doodle:gpu <neural-doodle arguments>

To start with an interactive shell inside the container

    nvidia-docker run --interactive --tty --volume="$(pwd)/data":/data/ --entrypoint=bash toksaitov/neural-doodle:gpu

## Docker Hub

[toksaitov/neural-doodle](https://hub.docker.com/r/toksaitov/neural-doodle)

## Credits

*Neural Doodle* is developed by [Alex J. Champandard](https://github.com/alexjc).

The Docker image was created by [Dmitrii Toksaitov](https://github.com/toksaitov).
