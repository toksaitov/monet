"use strict";

const mongoose =
  require("mongoose");

module.exports =
  new mongoose.Schema({
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
  });
