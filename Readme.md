monet-agent
===========

*monet-agent* is a task queue service for the *monet* system.

*monet-agent* periodically checks a task queue database for new tasks, fetches
one if available, gets associated data from a task database, starts
a long running style transfer process with [neural-doodle](https://github.com/alexjc/neural-doodle),
and periodically saves progress information with intermediate results back to
the task database. *monet-agent* can also listen to task queue events, to wake
up and start its work immediately.

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
* *etcd* `>= 2.3.0`
* *Redis* `>= 3.0.7`
* *MongoDB* `>= 3.2.5`

## Configuration

*monet-agent* tries to load a configuration files in the JSON format in the
current working directory under the name *monet-agent-configuration.json*

### Configuration Format

```json
{
  "option": "value",
  "option": ["value", "value"],
  "option": 42
}
```

### Configuration Options

* `"periodic": boolean`

  a flag to enable periodic checks of the task queue (set to true by default)

* `"periodicDelay": number`

  time in milliseconds between task queue checks (set to 1000 by default)

* `"databases": object`

  database connection options to the `service` database for service discovery
  and health checks, `queue` database for the task queue service, and `task`
  database to fetch submission data.

  Connection options are mostly passed as it is to the database driver. Refer to
  documentation of the current drivers for all available options.

  * discovery: etcd, [node-etcd](https://github.com/stianeikeland/node-etcd)
  * queue: Redis, [node_redis](https://github.com/noderedis/node_redis)
  * task: MongoDB, [mongoose](https://github.com/Automattic/mongoose)

  Database connection options can be overriden with a JSON entry in the
  following environment variables

  * *MONET_AGENT_DISCOVERY_DATABASE*
  * *MONET_AGENT_QUEUE_DATABASE*
  * *MONET_AGENT_TASK_DATABASE*

  By default Redis and Mongo database connection options will be set to point to
  a set of special names (see *Interconnection*) that you can resolve on your
  own (through `/etc/hosts` for example). Absence of etcd connection options
  will disable the use of it.

### Sample Configuration Files

```json
{
  "periodic": true,
  "periodicDelay": 1000,
  "databases": {
    "service": {
      "hosts": ["0.0.0.0:2379"]
    },
    "queue": {
      "host": "0.0.0.0",
      "port": "6379"
    },
    "task": {
      "url": "mongodb://0.0.0.0:27017/monet"
    }
  },
  "programs": {
    "neural-doodle": {
      "command": "python3",
      "script": "/neural-doodle/doodle.py",
      "arguments": [],
      "workingDirectory": "/data"
    }
  }
}
```

## Interconnection

By default the `host` field in connection options for the task and queue
databases will be set to the following values

* *monet-queue-db*: resolve it to an instance of a Redis database with a task
  queue

* *monet-task-db*: resolve it to an instance of a Mongo database with a
  collection of tasks

There are many approaches that you can use for name resolution. You can add
entries to `/etc/hosts` manually, setup a DNS server or utilize Docker Networks
to manage `hosts` files across services automatically.

## Usage

* `npm install`: to install dependencies

* `npm start`: to start the server

## Containerization

* `docker-compose build`: to build the *monet-agent* image

* `docker-compose up`: to start the service

* `docker-compose down`: to stop the service

* `docker-compose -f docker-compose.yml -f docker-compose.gpu.yml ...`: to work
  with the GPU variant of the *neural-doodle* image

* `docker-compose -f docker-compose.yml -f docker-compose.development.yml
   [-f docker-compose.gpu.yml]...`: to mount the project directory on the host
  machine under a project directory inside the container to allow instant source
  changes throughout development without rebuilds.

## Licensing

*monet-agent* is licensed under the MIT license. See LICENSE for the full
license text.

## Credits

*Neural Doodle* is developed by [Alex J. Champandard](https://github.com/alexjc).

*monet-agent* was created by [Dmitrii Toksaitov](https://github.com/toksaitov).
