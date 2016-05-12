monet-api
=========

*monet-api* is an API endpoint for the *monet* service. It works as a front end
for all clients interested to use the *monet* system.

# Services

*monet-api* is part of the *monet* system to provide a distributed image
generation back end for the project [Neural Doodle](https://github.com/alexjc/neural-doodle)
created by [Alex J. Champandard](https://github.com/alexjc).

* API Endpoint
    * [monet-api](https://github.com/toksaitov/monet-api)
* Task Runner
    * [monet-agent](https://github.com/toksaitov/monet-agent)
* [Nerual-Doodle](https://github.com/alexjc/neural-doodle) Docker Container Images
    * [neural-doodle-cpu](https://github.com/toksaitov/neural-doodle-cpu)
    * [neural-doodle-gpu](https://github.com/toksaitov/neural-doodle-gpu)

## Prerequisites

* *Node.js*, *npm* `>=4.4.4`, `>=2.15.2`
* *Docker*, *Docker Compose* `>= 1.11`, `>= 1.7.0`
* *Redis* `>= 3.0.7`
* *MongoDB* `>= 3.2.5`

## Communication

*monet-api* responds to the following HTTP requests

**GET** */artworks*

The `/artworks` request returns an array of all available artworks.

```json
[
  {
    "id": "a unique artwork ID to use during requests to process a semantic map",
    "title": "its title",
    "author": "an artist's name",
    "year": 1881,
    "image": "image data as a Base64 string"
  }
]
```

**POST** */process*

```json
{
  "artworkID": "a unique artwork ID",
  "map": "a semantic map to generate a new work as a Base64 string"
}
```

For the `/process` request *monet-api* puts a new picture generation task for
the specified semantic map (doodle) to a service task queue while returning a
task ID to allow clients to use it to check on the progress, and get an
intermediate or final result.

```json
{
  "taskID": "a unique task ID to check on results or task's progress"
}
```

**GET** */tasks/:id*

The `/tasks/:id` request returns progress information for a task with its
intermediate or final results.

```json
{
  "id": "a unique task ID",
  "artworkID": "a unique artwork ID used to generate a new picture",
  "progress": 1.0,
  "images": [
    "intermediate image as a Base64 string",
    "intermediate image with higher resolution as a Base64 string",
    "final image as a Base64 string"
  ]
}
```

Progress information is passed as a number between 0 and 1.0.

## Interconnection

Ensure that the following hosts can be resolved into IP addresses of the actual
services on your setup

* *monet-queue-db*: to an instance of a Redis database with a task queue

* *monet-task-db*: to an instance of a Mongo database with a collection of
  tasks

* *monet-artwork-db*: to an instance of a Mongo database with a collection of
  artworks

There are many approaches that you can use for name resolution. You can add
entries to `/etc/hosts` manually, setup a DNS server or utilize Docker Networks
to manage `hosts` files across services automatically.

## Usage

* `npm install`: to install dependencies

* `npm run gulp`: to recreate the `mongo` database and import sample data
  from the `artworks` directory

* `npm start`: to start the server

## Containerization

* `docker-compose build`: to build the *monet-api* image

* `docker-compose up`: to start the service

* `docker-compose up -d`: to start the service in the background

* `docker-compose down`: to stop the service

* `docker exec monet_monet-api_1 npm run gulp`: to recreate the `artworks`
  collection inside the `monet-artwork-db` container and import sample data from
  the `artworks` directory

* `docker-compose -f docker-compose.yml -f docker-compose.development.yml
   [-f docker-compose.gpu.yml] ...`: to mount the project directory on the host
  machine under a project directory inside the container to allow instant source
  changes throughout development without rebuilds.

## Licensing

*monet-api* is licensed under the MIT license. See LICENSE for the full license
text.

## Credits

*monet-api* was created by [Dmitrii Toksaitov](https://github.com/toksaitov).
