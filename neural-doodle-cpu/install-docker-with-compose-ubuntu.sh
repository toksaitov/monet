#!/usr/bin/env bash

# Install dependencies

apt-get update
apt-get install --assume-yes "wget"

# Install Docker Engine

wget --quiet --output-document="-" "https://get.docker.com" | sh
usermod --append --groups="docker" "$SUDO_USER"

# Install Docker Compose

DOCKER_COMPOSE="docker-compose-$(uname --kernel-name)-$(uname --machine)"
DOCKER_COMPOSE_URL="https://github.com/docker/compose/releases/download/1.6.2"
DOCKER_COMPOSE_EXECUTABLE="/usr/local/bin/docker-compose"

wget --output-document="$DOCKER_COMPOSE_EXECUTABLE" "$DOCKER_COMPOSE_URL/$DOCKER_COMPOSE"
chmod +x "$DOCKER_COMPOSE_EXECUTABLE"
