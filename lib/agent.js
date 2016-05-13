"use strict";

const fs =
  require("fs");
const spawn =
  require("child_process").spawn;
const path =
  require("path");

const Etcd =
  require("node-etcd");
const redis =
  require("redis");
const mongoose =
  require("mongoose");
const uuid =
  require("node-uuid");
const logger =
  require("winston");

function Agent() {
  this.id =
    uuid.v4();

  this.databases = {
    "service": {
      "connection": null,
      "connectionData": null
    },
    "queue": {
      "connection": null,
      "connectionData": null
    },
    "task": {
      "connection": null,
      "connectionData": null
    }
  };

  this.busy =
    false;
  this.quiet =
    true;

  this.taskListID =
    `queue:${this.id}`;

  let configurationFiles = [
    "./monet-agent-configuration.json"
  ];

  this.configuration =
    this._loadConfiguration(configurationFiles);

  this.frameDirectory =
    this._resolveFrameDirectory();

  this._registerModels();
}

Agent.prototype = {
  constructor: Agent,

  start: function() {
    logger.info(`Agent '${this.id}': starting at ${new Date()}`);

    let databases =
      this.databases;

    let serviceDatabaseConnectionData =
      databases["service"]["connectionData"];
    let serviceDatabase =
      databases["service"]["connection"] =
        this._connectToEtcd(
          "serviceDatabase",
          serviceDatabaseConnectionData
        );

    if (!serviceDatabase) {
      this._setupDatabases();

      return;
    }

    serviceDatabase.get("services/queueDatabase", (error, value) => {
      if (error) {
        logger.error(
          "Failed to get information about 'queueDatabase' from the " +
          "'serviceDatabase'",
          serviceDatabaseConnectionData
        );
      }

      databases["queue"]["connectionData"] =
        value || databases["queue"]["connectionData"];

      serviceDatabase.get("services/taskDatabase", (error, value) => {
        if (error) {
          logger.error(
            "Failed to get information about 'taskDatabase' from the " +
            "'serviceDatabase'",
            serviceDatabaseConnectionData
          );
        }

        databases["task"]["connectionData"] =
          value || databases["task"]["connectionData"];

        this._setupDatabases();
      });
    });
  },

  _loadConfiguration: function(configurationFiles) {
    logger.info(
      `Agent '${this.id}': loading configuration from '${configurationFiles}'`
    );

    let mergedConfiguration =
      { };

    configurationFiles.forEach(configurationFile => {
      let configurationFileContent =
        null;

      try {
        configurationFileContent =
          fs.readFileSync(path.resolve(configurationFile), "utf-8");
      } catch (error) {
        logger.warn(
          `Failed to read the configuration file '${configurationFile}'`
        );
      }

      let configuration =
        { };

      if (configurationFileContent) {
        try {
          configuration =
            JSON.parse(configurationFileContent);
        } catch (error) {
          logger.error(
            `Failed to parse the configuration file '${configurationFile}'`,
            configurationFileContent
          );
          logger.error(error);
        }

        for (let property in configuration) {
          if (configuration.hasOwnProperty(property)) {
            mergedConfiguration[property] =
              configuration[property];
          }
        }
      }
    });

    return this._resolveConfiguration(mergedConfiguration);
  },

  _resolveConfiguration: function(configuration) {
    logger.info(`Agent '${this.id}': resolving configuration`);

    if (typeof configuration["periodic"] !== "boolean") {
      configuration["periodic"] =
        true;
    }
    configuration["periodicDelay"] =
      configuration["periodicDelay"] || 1000;

    let databaseConfigurations =
      configuration["databases"] =
        configuration["databases"] || { };

    databaseConfigurations["service"] =
      this._extractEnvironmentConfiguration("MONET_DISCOVERY_DATABASE") ||
        databaseConfigurations["service"];
    databaseConfigurations["queue"] =
      this._extractEnvironmentConfiguration("MONET_QUEUE_DATABASE") ||
        databaseConfigurations["queue"] || {
          "host": "monet-queue-db",
          "port": "6379"
        };
    databaseConfigurations["task"] =
      this._extractEnvironmentConfiguration("MONET_TASK_DATABASE") ||
        databaseConfigurations["task"] || {
          "url": "mongodb://monet-task-db:27017/monet",
          "options": { }
        };

    let databases =
      this.databases;

    databases["service"]["connectionData"] =
      databaseConfigurations["service"];
    databases["queue"]["connectionData"] =
      databaseConfigurations["queue"];
    databases["task"]["connectionData"] =
      databaseConfigurations["task"];

    let programConfigurations =
      configuration["programs"] =
        configuration["programs"] || { };
    let neuralDoodleConfiguration =
      programConfigurations["neural-doodle"] =
        programConfigurations["neural-doodle"] || { };

    neuralDoodleConfiguration["command"] =
      neuralDoodleConfiguration["command"] ||
        "python3";
    neuralDoodleConfiguration["script"] =
      neuralDoodleConfiguration["script"] ||
        "/neural-doodle/doodle.py";
    neuralDoodleConfiguration["arguments"] =
      neuralDoodleConfiguration["arguments"] ||
        [];
    neuralDoodleConfiguration["workingDirectory"] =
      neuralDoodleConfiguration["workingDirectory"] ||
        "/data";

    return configuration;
  },

  _extractEnvironmentConfiguration: function(serviceKey) {
    logger.info(
      `Agent '${this.id}': extracting environment configuration for service ` +
      `key '${serviceKey}'`
    );

    let environmentConfiguration =
      null;

    let environmentValue = process.env[serviceKey];
    if (environmentValue) {
      try {
        environmentConfiguration =
          JSON.parse(environmentValue);
      } catch(error) {
        logger.error(
          `Failed to parse environment configuration '${environmentValue}' ` +
          `under the key '${serviceKey}'`,
          process.env
        );
        logger.error(error);
      }
    }

    return environmentConfiguration;
  },

  _registerModels: function() {
    logger.info(`Agent '${this.id}': registering models`);

    let taskSchema =
      require("./models/task.js");

    mongoose.model("Task", taskSchema);
  },

  _connectToEtcd: function(name, connectionData) {
    if (!connectionData) {
      return null;
    }

    logger.info(
      `Agent '${this.id}': connecting to the etcd service '${name}'`,
      connectionData
    );

    let hosts =
      connectionData["hosts"];
    let sslOptions =
      connectionData["sslOptions"];

    let database =
      new Etcd(hosts, sslOptions);

    return database;
  },

  _connectToRedisDatabase: function(name, connectionData) {
    logger.info(
      `Agent '${this.id}': connecting to the Redis service '${name}'`,
      connectionData
    );

    let database =
      redis.createClient(connectionData);

    database.on("ready", () => {
      logger.info(`Connected to '${name}'`);
    });
    database.on("reconnecting", () => {
      logger.info(`Reconnecting to '${name}'`);
    });
    database.on("end", () => {
      logger.info(`Disconnected from '${name}'`);
    });
    database.on("error", error => {
      logger.error(`An error has occured while working with '${name}'`);
      logger.error(error);
    });

    return database;
  },

  _connectToMongoDatabase: function(name, connectionData) {
    logger.info(
      `Agent '${this.id}': connecting to the Mongo service '${name}'`,
      connectionData
    );

    let url =
      connectionData["url"];
    let options =
      connectionData["options"];

    let database =
      mongoose.createConnection(
        url, options
      );

    database.on("open", () => {
      logger.info(`Connected to '${name}'`);
    });
    database.on("reconnected", () => {
      logger.info(`Reconnected to '${name}'`);
    });
    database.on("close", () => {
      logger.info(`Disconnected from '${name}'`);
    });
    database.on("error", error => {
      logger.error(`An error has occured while working with '${name}'`);
      logger.error(error);
    });

    return database;
  },

  _setupDatabases: function() {
    logger.info(`Agent '${this.id}': setting up key database connections`);

    let databases =
      this.databases;
    let queueDatabaseConnectionData =
      databases["queue"]["connectionData"];
    let taskDatabaseConnectionData =
      databases["task"]["connectionData"];

    databases["queue"]["connection"] =
      this._connectToRedisDatabase(
        "queueDatabase",
        queueDatabaseConnectionData
      );
    databases["task"]["connection"] =
      this._connectToMongoDatabase(
        "taskDatabase",
        taskDatabaseConnectionData
      );

    this._setupEventHandling();
    this._setupPeriodicTaskQueueChecks();
  },

  _setupEventHandling: function() {
    logger.info(`Agent '${this.id}': setting up event handlers`);

    let databases =
      this.databases;

    let queueDatabaseConnectionData =
      databases["queue"]["connectionData"];
    let queueDatabase =
      this._connectToRedisDatabase(
        "queueDatabaseEvents",
        queueDatabaseConnectionData
      );

    let channel =
      "queue:taskQueued";

    queueDatabase.subscribe(channel, error => {
      if (error) {
        logger.error(
          `Failed to subscribe to the channel '${channel}' in the ` +
          "'queueDatabase'",
          queueDatabaseConnectionData
        );
        logger.error(error);
      }
    });

    queueDatabase.on("message", () => {
      this._checkTaskQueue();
    });
  },

  _setupPeriodicTaskQueueChecks: function() {
    logger.info(`Agent '${this.id}': setting up periodic task queue checks`);

    let configuration =
      this.configuration;

    let periodicTaskQueueCheckEnabled =
      configuration["periodic"];
    let periodicTaskQueueCheckDelay =
      configuration["periodicDelay"];

    if (periodicTaskQueueCheckEnabled) {
      setInterval(() => {
        this._checkTaskQueue();
      }, periodicTaskQueueCheckDelay);
    }
  },

  _checkTaskQueue: function() {
    if (!this.quiet) {
      logger.info(
        `Agent '${this.id}': checking task queue at ${new Date()}`
      );
    }

    let databases =
      this.databases;

    let queueDatabase =
      databases["queue"]["connection"];
    let queueDatabaseConnectionData =
      databases["queue"]["connectionData"];

    let taskListID =
      this.taskListID;

    if (!this.busy) {
      this.busy =
        true;

      queueDatabase.rpoplpush("queue:tasks", taskListID, (error, taskID) => {
        if (error || !taskID) {
          if (error) {
            logger.error(
              `Failed to get a task ID from the task queue '${taskListID}' ` +
              "in the 'queueDatabase'",
              queueDatabaseConnectionData
            );
            logger.error(error);
          }

          this.busy =
            false;
        } else {
          this._processTaskID(taskID);
        }
      });
    }
  },

  _processTaskID: function(taskID) {
    logger.info(
      `Agent '${this.id}': attempting to get task data for the ID '${taskID}'`
    );

    let databases =
      this.databases;

    let taskDatabase =
      databases["task"]["connection"];
    let taskDatabaseConnectionData =
      databases["task"]["connectionData"];

    let Task =
      taskDatabase.model("Task");

    Task.findById(taskID, (error, task) => {
      if (error || !task) {
        logger.error(
          `Failed to get a task document for task ID '${taskID}' from the ` +
          "'taskDatabase'",
          taskDatabaseConnectionData
        );
        logger.error(error);

        if (task) {
          this._finishProcessingTask(task);
        } else {
          this._finishProcessingTask({
            "id": taskID
          });
        }
      } else {
        this._processNeuralDoodleTask(task);
      }
    });
  },

  _finishProcessingTask: function(task) {
    logger.info(
      `Agent '${this.id}': finishing processing the task '${task.id}'`
    );

    this.busy =
      false;

    this._removeFromTaskList(task);
  },

  _removeFromTaskList: function(task) {
    logger.info(
      `Agent '${this.id}': removing the task '${task.id}' from the ` +
      "agent's task list"
    );

    let databases =
      this.databases;

    let queueDatabase =
      databases["queue"]["connection"];
    let queueDatabaseConnectionData =
      databases["queue"]["connectionData"];

    let taskID =
      task.id;
    let taskListID =
      this.taskListID;

    queueDatabase.lrem(taskListID, 0, taskID, error => {
      if (error) {
        logger.error(
          `Failed to clean up the agent list '${taskListID}' in the ` +
          `'queueDatabase' from the task ID '${taskID}'`,
          queueDatabaseConnectionData
        );
        logger.error(error);
      }
    });
  },

  _backoffProcessingTask: function(task) {
    logger.info(
      `Agent '${this.id}': stopping processing the task '${task.id}' and ` +
      "putting it back to the queue"
    );

    this.busy =
      false;

    this._returnToQueue(task);
  },

  _returnToQueue: function(task) {
    logger.info(
      `Agent '${this.id}': removing the task '${task.id}' from the ` +
      "agent's task list and putting it back to the queue"
    );

    let databases =
      this.databases;

    let queueDatabase =
      databases["queue"]["connection"];
    let queueDatabaseConnectionData =
      databases["queue"]["connectionData"];

    let taskID =
      task.id;
    let taskListID =
      this.taskListID;

    queueDatabase.lpop(taskListID, (error, result) => {
      if (error) {
        logger.error(
          `Failed to remove the task with ID '${taskID}' from the service ` +
          `list '${taskListID}' in the 'queueDatabase'`,
          queueDatabaseConnectionData
        );
        logger.error(error);

        this._removeFromTaskList(task);

        return;
      }

      queueDatabase.rpush("queue:tasks", result, error => {
        if (error) {
          logger.error(
            `Failed to put back the task with ID '${taskID}' to the task ` +
            `queue from the service list '${taskListID}' in the 'queueDatabase'`,
            queueDatabaseConnectionData
          );
          logger.error(error);
        }
      });
    });
  },

  _processNeuralDoodleTask: function(task) {
    logger.info(
      `Agent '${this.id}': processing the neural-doodle task '${task.id}'`
    );

    let configuration =
      this.configuration;
    let programConfigurations =
      configuration["programs"];
    let neuralDoodleConfiguration =
      programConfigurations["neural-doodle"];

    let workingDirectory =
      neuralDoodleConfiguration["workingDirectory"];
    let fileExtension =
      "png";

    let styleFile =
      path.join(
        workingDirectory,
        `${uuid.v4()}.${fileExtension}`
      );
    let styleSemanticMapFile =
      path.join(
        workingDirectory,
        path.basename(styleFile, `.${fileExtension}`) +
          `_sem.${fileExtension}`
      );
    let outputSemanticMapFile =
      path.join(
        workingDirectory,
        `${uuid.v4()}_sem.${fileExtension}`
      );

    let styleBuffer = null;
    try {
      styleBuffer =
        task.inputs[0];
    } catch (error) {
      logger.error("The base style was not provided");
      logger.error(error);

      this._finishProcessingTask(task);

      return;
    }

    let styleSemanticMapBuffer = null;
    try {
      styleSemanticMapBuffer =
        task.inputs[1];
    } catch (error) {
      logger.error("A semantic map for the base style was not provided");
      logger.error(error);

      this._finishProcessingTask(task);

      return;
    }

    let outputSemanticMapBuffer = null;
    try {
      outputSemanticMapBuffer =
        task.inputs[2];
    } catch (error) {
      logger.error("An output semantic map was not provided");
      logger.error(error);

      this._finishProcessingTask(task);

      return;
    }

    fs.writeFile(styleFile, styleBuffer, error => {
      if (error) {
        logger.error(
          "Failed to write a style buffer from a task " +
          `under '${styleFile}'`,
          task
        );
        logger.error(error);

        this._finishProcessingTask(task);
      } else {
        fs.writeFile(styleSemanticMapFile, styleSemanticMapBuffer, error => {
          if (error) {
            logger.error(
              "Failed to write a style semantic map buffer from a task " +
              `under '${styleSemanticMapFile}'`,
              task
            );
            logger.error(error);

            this._finishProcessingTask(task);
          } else {
            fs.writeFile(outputSemanticMapFile, outputSemanticMapBuffer, error => {
              if (error) {
                logger.error(
                  "Failed to write an output semantic map buffer from a task " +
                  `under '${outputSemanticMapFile}'`,
                  task
                );
                logger.error(error);

                this._finishProcessingTask(task);
              } else {
                task.started =
                  Date.now();
                task.state =
                  "started";

                this._saveTask(task);
                this._startNeuralDoodleSubprocess(
                  task,
                  styleFile,
                  outputSemanticMapFile
                );
              }
            });
          }
        });
      }
    });
  },

  _resolveFrameDirectory: function() {
    let configuration =
      this.configuration;
    let programConfigurations =
      configuration["programs"];
    let neuralDoodleConfiguration =
      programConfigurations["neural-doodle"];
    let workingDirectory =
      neuralDoodleConfiguration["workingDirectory"];

    let frameDirectory =
      path.resolve(path.join(workingDirectory, "frames"));

    return frameDirectory;
  },

  _directoryExists: function(directory) {
    try {
      return fs.statSync(directory).isDirectory();
    } catch (error) {
      return false;
    }
  },

  _cleanupDirectory: function(directory) {
    try {
      let entries =
        fs.readdirSync(directory);

      entries =
        entries.map(entry => path.join(directory, entry));
      entries =
        entries.filter(entry => fs.statSync(entry).isFile());

      entries.forEach(entry => fs.unlinkSync(entry));
    } catch (error) {
      logger.error(`Failed to cleanup the directory '${directory}'`);
      logger.error(error);
    }
  },

  _createDirectory: function(directory) {
    try {
      fs.mkdirSync(directory);
    } catch (error) {
      logger.error(`Failed to create a directory '${directory}'`);
      logger.error(error);
    }
  },

  _prepareDirectory: function(directory) {
    if (this._directoryExists(directory)) {
      this._cleanupDirectory(directory);
    } else {
      this._createDirectory(directory);
    }
  },

  _countFiles: function(directory) {
    let count =
      0;

    try {
      let entries =
        fs.readdirSync(directory);

      entries =
        entries.map(entry => path.join(directory, entry));
      entries =
        entries.filter(entry => fs.statSync(entry).isFile());

      count =
        entries.length;
    } catch (error) {
      logger.error(`Failed to count files from the directory '${directory}'`);
      logger.error(error);
    }

    return count;
  },

  _loadFiles: function(directory) {
    let files =
      [];

    try {
      let entries =
        fs.readdirSync(directory);

      entries =
        entries.map(entry => path.join(directory, entry));
      entries =
        entries.filter(entry => fs.statSync(entry).isFile());

      entries.forEach(entry => {
        try {
          let buffer =
            fs.readFileSync(entry);

          if (buffer && buffer.length > 0) {
            files.push(buffer);
          }
        } catch (ignored) { }
      });
    } catch (error) {
      logger.info(`Failed to load files from the directory '${directory}'`);
    }

    return files;
  },

  _extractIterationsArgument: function(commandArguments) {
    let iterations =
      100;

    commandArguments.forEach(argument => {
      let matches =
        argument.match(/--iterations[\s=]+(\d+)/);

      if (matches && matches.length > 0) {
        iterations =
          Math.max(1, +matches[1]);
      }
    });

    return iterations;
  },

  _extractSaveEveryArgument: function(commandArguments) {
    let saveEvery =
      10;

    commandArguments.forEach(argument => {
      let matches =
        argument.match(/--save-every[\s=]+(\d+)/);

      if (matches && matches.length > 0) {
        saveEvery =
          Math.max(1, +matches[1]);
      }
    });

    return saveEvery;
  },

  _startNeuralDoodleSubprocess: function(task, styleFile, outputSemanticMapFile) {
    let configuration =
      this.configuration;
    let programConfigurations =
      configuration["programs"];
    let neuralDoodleConfiguration =
      programConfigurations["neural-doodle"];

    let command =
      neuralDoodleConfiguration["command"];
    let script =
      neuralDoodleConfiguration["script"];
    let workingDirectory =
      neuralDoodleConfiguration["workingDirectory"];

    let fileExtension =
      "png";

    let outputFile =
      path.join(
        workingDirectory,
        path.basename(outputSemanticMapFile, `_sem.${fileExtension}`) +
          `.${fileExtension}`
      );

    let phases =
      3;
    let args =
      [script].
        concat(neuralDoodleConfiguration["arguments"]).
        concat(task.arguments).
        concat([
          `--phases=${phases}`,
          `--style=${styleFile}`,
          `--output=${outputFile}`
        ]);

    logger.info(
      `Agent '${this.id}': starting the neural-doodle subprocess `    +
      `to handle the task '${task.id}' with the following arguments ` +
      `'${args.join(" ")}'`
    );

    let frameDirectory =
      this.frameDirectory;

    let previousFrameCount =
      0;
    let iterations =
      this._extractIterationsArgument(args);
    let saveEvery =
      this._extractSaveEveryArgument(args);
    let totalFrameCount =
      Math.max(1, iterations / saveEvery * phases);

    this._prepareDirectory(frameDirectory);

    let fileWatcher =
      fs.watch(frameDirectory);

    fileWatcher.on("change", (event, fileName) => {
      let frameCount =
        this._countFiles(frameDirectory);

      if (frameCount === previousFrameCount) {
        return;
      }

      previousFrameCount =
        frameCount;

      let progress =
        frameCount / totalFrameCount;

      if (progress >= 1) {
        progress =
          0.99;
      }

      progress =
        progress.toPrecision(2);

      logger.info(
        `Agent '${this.id}': saving an intermediate file '${fileName}' ` +
        `to the task '${task.id}', progress: '${progress}'`
      );

      task.progress =
        progress;

      task.outputs =
        this._loadFiles(frameDirectory);

      this._saveTask(task);
    });

    let program =
      spawn(command, args, {
        "cwd": workingDirectory,
        "stdio": "inherit"
      });

    program.on("error", error => {
      if (error) {
        logger.error(
          `Failed to start a child process '${command}' with the following ` +
          `arguments '${args.join(" ")}'`
        );
        logger.error(error);
      }

      fileWatcher.close();

      task.progress =
        1.0;
      task.state =
        "failed";
      task.processErrors.push(
        error
      );
      task.finished =
        Date.now();

      this._saveTask(task);
      this._finishProcessingTask(task);
    });

    program.on("close", code => {
      logger.info(
        `The child process '${command}' started with the following `      +
        `arguments '${args.join(" ")}' has finished its work with code ` +
        `'${code}'`
      );

      fileWatcher.close();

      task.progress =
        1.0;
      task.state =
        "finished";
      task.finished =
        Date.now();

      fs.readFile(outputFile, (error, data) => {
        if (error) {
          logger.error(
            `Failed to read the final output file '${outputFile}' ` +
            `to save it to the task '${task.id}'`
          );
          logger.error(error);
        } else {
          task.outputs.push(data);
        }

        this._saveTask(task);
        this._finishProcessingTask(task);
      });
    });
  },

  _saveTask: function(task) {
    logger.info(`Agent '${this.id}': updating the task '${task.id}'`);

    let databases =
      this.databases;
    let taskDatabaseConnectionData =
      databases["task"]["connectionData"];

    task.save(error => {
      if (error) {
        logger.error(
          "Failed to save a task into the 'taskDatabase'",
          taskDatabaseConnectionData
        );
        logger.error(error);
      }
    });
  }
};

module.exports =
  Agent;
