"use strict";

const mongoose =
  require("mongoose");

function transform(document, result) {
  result.id =
    document.id;
  result.image =
    document.image.toString("base64");

  delete result._id;
  delete result.__v;
  delete result.map;
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
    "title": String,
    "author": String,
    "year": Number,

    "image": {
      "type": Buffer,
      "required": true
    },
    "map": {
      "type": Buffer,
      "required": true
    }
  }, options);
