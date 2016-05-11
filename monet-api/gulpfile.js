"use strict";

const fs =
  require("fs");
const path =
  require("path");

const gulp =
  require("gulp");
const mongoose =
  require("mongoose");
mongoose.model(
  "Artwork", require("./lib/models/artwork.js")
);

const ArtworkDirectory =
  "artworks";
const ImageFileName =
  "image.png"
const MapFileName =
  "map.png"

const ArtworkDatabaseConnectionOptions = {
  "url": "mongodb://monet-artwork-db:27017/monet",
  "options": { }
};

function formArtworkDirectoryListForDirectory(directory) {
  let entries =
    fs.readdirSync(directory);

  entries =
    entries.map(entry => path.join(directory, entry));
  entries =
    entries.filter(entry => fs.statSync(entry).isDirectory());

  return entries;
}

function findArtworkFileForDirectory(directory) {
  let entries =
    fs.readdirSync(directory);

  entries =
    entries.map(entry => path.join(directory, entry));
  entries =
    entries.filter(
      entry => (/^.*\.json$/).test(entry) && fs.statSync(entry).isFile()
    );

  return entries[0];
}

function removeArtworkCollection(onFinishCallback) {
  console.log(`Removing the artwork collection.`);

  let Artwork =
    mongoose.model("Artwork");

  Artwork.remove({}, error => {
    if (error) {
      console.error(error);
      throw error;
    }

    onFinishCallback();
  });
}

function importArtwork(artworkDirectory, onFinishCallback) {
  let resolvedArtworkDirectory =
    path.resolve(artworkDirectory);

  let imageFile =
    path.join(resolvedArtworkDirectory, ImageFileName);
  let imageData =
    fs.readFileSync(imageFile);

  let mapFile =
    path.join(resolvedArtworkDirectory, MapFileName);
  let mapData =
    fs.readFileSync(mapFile);

  let artworkFile =
    findArtworkFileForDirectory(resolvedArtworkDirectory);
  let artworkData =
    JSON.parse(fs.readFileSync(artworkFile, "utf8"));

  artworkData["_id"] =
    mongoose.Types.ObjectId(artworkData["_id"]["$oid"]);
  artworkData["image"] =
    imageData;
  artworkData["map"] =
    mapData;

  console.log(`Importing the document '${artworkFile}'.`);

  let Artwork =
    mongoose.model("Artwork");

  let artwork =
    new Artwork(artworkData);

  artwork.save(error => {
    if (error) {
      console.error(error);

      throw error;
    }

    onFinishCallback();
  });
}

function importArtworks(artworkDirectories, onFinishCallback) {
  let artworkDirectory =
    artworkDirectories.shift();

  if (artworkDirectory) {
    importArtwork(artworkDirectory, () => {
      importArtworks(artworkDirectories, onFinishCallback);
    });
  } else {
    mongoose.disconnect(() => {
      onFinishCallback();
    });
  }
}

gulp.task("artworks", onFinishCallback => {
  mongoose.connect(
    ArtworkDatabaseConnectionOptions["url"],
    ArtworkDatabaseConnectionOptions["options"]
  );

  removeArtworkCollection(() => {
    let artworkDirectories =
      formArtworkDirectoryListForDirectory(ArtworkDirectory);

    importArtworks(artworkDirectories, onFinishCallback);
  });
});

gulp.task("default", ["artworks"]);
