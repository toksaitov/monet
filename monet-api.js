"use strict";

const util =
  require("util");

const express =
  require("express");
const bodyParser =
  require("body-parser");
const redis =
  require("redis");
const winston =
  require("winston");

const Server =
  express();
const ServerPort =
  8080;

const Logger =
  new winston.Logger({
    transports: [new winston.transports.Console()]
  });

const QueueDatabaseConnectionOptions = {
  "host": "monet-queue-db",
  "port": 6379
};
const QueueDatabase =
  redis.createClient(
    QueueDatabaseConnectionOptions
  );

QueueDatabase.on("ready", () => {
  Logger.info("Connected to the queue database");
});
QueueDatabase.on("reconnecting", () => {
  Logger.info("Reconnected to the queue database");
});
QueueDatabase.on("end", () => {
  Logger.info("Disconnected from the queue database");
});
QueueDatabase.on("error", error => {
  Logger.error("The queue database client has encountered an error");
  Logger.error(error);
});

const mongoose =
  require("mongoose");
mongoose.model(
  "Task", require("./lib/models/task.js")
);
mongoose.model(
  "Artwork", require("./lib/models/artwork.js")
);

const TaskDatabaseConnectionOptions = {
  "url": "mongodb://monet-task-db:27017/monet",
  "options": { }
};
const TaskDatabase =
  mongoose.createConnection(
    TaskDatabaseConnectionOptions["url"],
    TaskDatabaseConnectionOptions["options"]
  );

TaskDatabase.on("open", () => {
  Logger.info("Connected to the task database");
});
TaskDatabase.on("reconnected", () => {
  Logger.info("Reconnected to the task database");
});
TaskDatabase.on("close", () => {
  Logger.warn("Disconnected from the task database");
});
TaskDatabase.on("error", error => {
  Logger.error("The task database client has encountered an error");
  Logger.error(error);
});

const ArtworkDatabaseConnectionOptions = {
  "url": "mongodb://monet-artwork-db:27017/monet",
  "options": { }
};
const ArtworkDatabase =
  mongoose.createConnection(
    ArtworkDatabaseConnectionOptions["url"],
    ArtworkDatabaseConnectionOptions["options"]
  );

ArtworkDatabase.on("open", () => {
  Logger.info("Connected to the artwork database");
});
ArtworkDatabase.on("reconnected", () => {
  Logger.info("Reconnected to the artwork database");
});
ArtworkDatabase.on("close", () => {
  Logger.warn("Disconnected from the artwork database");
});
ArtworkDatabase.on("error", error => {
  Logger.error("The artwork database client has encountered an error");
  Logger.error(error);
});

Server.use(bodyParser.json());

Server.use(express.static("public"));

function getArtworks(onResultCallback) {
  let Artwork =
    ArtworkDatabase.model("Artwork");

  Artwork.find((error, documents) => {
    let jsonDocuments = null;
    if (documents) {
      jsonDocuments =
        documents.map(document => document.toObject());
    }

    onResultCallback(error, jsonDocuments);
  });
}

function getArtwork(artworkID, onResultCallback) {
  let Artwork =
    ArtworkDatabase.model("Artwork");

  Artwork.findById(artworkID, onResultCallback);
}

function createNewTask(artworkID, encodedSemanticMap, onResultCallback) {
  getArtwork(artworkID, (error, artwork) => {
    if (error || !artwork) {
      return onResultCallback(error);
    }

    let Task =
      TaskDatabase.model("Task");

    let style =
      artwork.image;
    let styleSemanticMap =
      artwork.map;
    let outputSemanticMap =
      new Buffer(encodedSemanticMap, "base64");
    let iterations =
      40;

    let task =
      new Task({
        "artwork_id":
          mongoose.Types.ObjectId(artworkID),
        "inputs": [
          style,
          styleSemanticMap,
          outputSemanticMap
        ],
        "arguments": [
          `--iterations=${iterations}`
        ]
      });

    task.save((error, task) => {
      onResultCallback(error, task ? task.id : null);
    });
  });
}

function getTask(taskID, onResultCallback) {
  let Task =
    TaskDatabase.model("Task");

  Task.findById(taskID, (error, document) => {
    let jsonDocument = null;
    if (document) {
      jsonDocument =
        document.toObject();
    }

    onResultCallback(error, jsonDocument);
  });
}

function queueTask(taskID, onResultCallback) {
  QueueDatabase.rpush("queue:tasks", taskID, (error, reply) => {
    onResultCallback(error, reply);
  });
}

function publishTaskQueuedEvent(taskID) {
  QueueDatabase.publish("queue:taskQueued", taskID);
}

Server.get("/artworks", (request, response) => {
  getArtworks((error, artworks) => {
    if (error) {
      let message =
        "Failed to get a list of all artworks";

      Logger.error(`${message}\n`);
      Logger.error(`exception:\n${error}\n`);
      Logger.error(`request:\n${util.inspect(request, { "depth": 2 })}\n`);

      response.status(500).json({
        "error": message
      });

      return;
    }

    response.json(artworks);
  });
});

Server.post("/process", (request, response) => {
  let processError = parameters => {
    let code =
      parameters["code"];
    let message =
      parameters["message"];
    let responseMessage =
      parameters["response"] || message;
    let error =
      parameters["error"];

    if (message) {
      Logger.error(`${message}\n`);
    }
    if (error)   {
      Logger.error(`exception:\n${error}\n`);
    }
    if (request) {
      Logger.error(`request:\n${util.inspect(request, { "depth": 2 })}\n`);
    }

    if (code && response && responseMessage) {
      response.status(code).json({
        "error": responseMessage
      });
    }
  }

  let artworkID =
    request.body["artworkID"];

  if (!artworkID) {
    processError({
      "code": 400,
      "message": `The artwork ID was not provided.`
    });

    return;
  }

  let semanticMap =
    request.body["map"];

  if (!semanticMap) {
    processError({
      "code": 400,
      "response": "A semantic map was not provided.",
      "message": `A semantic map for the artwork ID '${artworkID}' ` +
                 "was not provided."
    });

    return;
  }

  createNewTask(artworkID, semanticMap, (error, taskID) => {
    if (error || !taskID) {
      processError({
        "code": 500,
        "response": "The monet system has failed.",
        "error": error || "",
        "message": "Failed to create a new task for the artwork ID " +
                   `'${artworkID}'.`
      });

      return;
    }

    queueTask(taskID, error => {
      if (error) {
        processError({
          "code": 500,
          "response": "The monet system has failed.",
          "error": error,
          "message": `Failed to add the task '${taskID}' for the artwork ` +
                     `'${artworkID}' to the task queue.`
        });

        return;
      }

      publishTaskQueuedEvent(taskID);

      response.json({ "taskID": taskID });
    });
  });
});

Server.get("/tasks/:id", (request, response) => {
  let taskID =
    request.params["id"];

  let processError = parameters => {
    let code =
      parameters["code"];
    let message =
      parameters["message"];
    let responseMessage =
      parameters["response"] || message;
    let error =
      parameters["error"];

    if (message) {
      Logger.error(`${message}\n`);
    }
    if (error)   {
      Logger.error(`exception:\n${error}\n`);
    }
    if (request) {
      Logger.error(`request:\n${util.inspect(request, { "depth": 2 })}\n`);
    }

    if (code && response && responseMessage) {
      response.status(code).json({
        "error": responseMessage
      });
    }
  }

  if (!taskID) {
    processError({
      "code": 400,
      "message": "The task ID was not provided."
    });

    return;
  }

  getTask(taskID, (error, task) => {
    if (error) {
      processError({
        "code": 400,
        "response": "Invalid task ID.",
        "error": error,
        "message": `Failed to find a task with the ID '${taskID}'.`
      });

      return;
    }

    response.json(task);
  });
});

Server.listen(ServerPort, () => {
  Logger.info(`monet-api is listening on port ${ServerPort}.`);
});
