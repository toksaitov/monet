"use strict";

const mongoose =
  require("mongoose");

function transform(document, result) {
  result.id =
    document._id;
  result.artworkID =
    document.artwork_id;
  result.images =
    document.outputs.map(output => output.toString("base64"));

  delete result._id;
  delete result.__v;
  delete result.artwork_id;
  delete result.inputs;
  delete result.outputs;
}

let options = {
  "toObject": {
    "transform": transform
  },
  "toJSON": {
    "transform": transform
  },
  "versionKey": false
};

module.exports =
  new mongoose.Schema({
    "artwork_id": {
      "type": mongoose.Schema.Types.ObjectId,
      "required": true
    },

    "inputs": {
      "type": [Buffer],
      "required": true
    },
    "outputs": {
      "type": [Buffer],
      "default": []
    },

    "state": {
      "type": String,
      "default": "queued"
    },
    "processErrors": {
      "type": [String],
      "default": []
    },

    "arguments": {
      "type": [String],
      "default": []
    },

    "progress": {
      "type": Number,
      "default": 0.0
    },

    "queued": {
      "type": Date,
      "default": Date.now
    },
    "started": Date,
    "finished": Date
  }, options);
