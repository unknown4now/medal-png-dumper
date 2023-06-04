const fs = require('fs');
const vpk = require('vpk');
const path = require('path');
const Jimp = require('jimp');
const svdf = require('simple-vdf');

const defaultCSGOPath = 'C:/Program Files (x86)/Steam/steamapps/common/Counter-Strike Global Offensive'; // You can change it here your CSGO path.
const csgoPath = process.argv[2] || defaultCSGOPath;

if (!fs.existsSync('./png/')) fs.mkdirSync('./png/');

// Parsing item dictionary from 'items_game.txt' using simple-vdf package
const itemDictionary = svdf.parse(fs.readFileSync(path.join(csgoPath, 'csgo', 'scripts', 'items', 'items_game.txt')).toString()).items_game.items;

// Loading VPK archive
const archive = new vpk(path.join(csgoPath, 'csgo', 'pak01_dir.vpk'));
archive.load();

// Filtering status icons files from the archive
let statusIcons = archive.files.filter(path => path.startsWith('resource/flash/econ/status_icons'));

// Adding 'last' function to the Array prototype
Array.prototype.last = function() {
  return this[this.length - 1];
}

// Filtering the status icons based on specific conditions
statusIcons = statusIcons.filter(icon => {
  if (!icon.startsWith('resource/flash/econ/status_icons')) return false;
  const iconSizing = icon.split('/').last().split('.')[0].split('_').last();
  const size = iconSizing == 'small' || iconSizing == 'large' ? iconSizing : 'regular';
  let name = icon.split('/').last().split('.')[0].split('_');
  if (size == 'large' || size == 'small') name.pop();
  name = name.join('_');
  if (size == 'large') return true;
  if (size == 'regular' && !statusIcons.some(x => x.includes(`${name}_large.png`))) return true;
  if (size == 'small' && !statusIcons.some(x => x.includes(`${name}_large.png`))) return true && !statusIcons.some(x => x.includes(`${name}.png`));
  return false;
});

// Processing each status icon and extracting the corresponding item image
statusIcons.forEach(statusIcon => {
  let rName = statusIcon.split('/').last().split('.')[0].split('_');
  if (rName.last() == 'large' || rName.last() == 'small') rName.pop();
  rName = rName.join('_');

  for (const item in itemDictionary) {
    if (itemDictionary[item].image_inventory) {
      if (itemDictionary[item].image_inventory == `econ/status_icons/${rName}`) {
        // Reading the status icon image using Jimp
        Jimp.read(archive.getFile(statusIcon), (err, image) => {
          if (err) {
            console.error(err);
            return;
          }

          const width = image.bitmap.width;
          const height = image.bitmap.height;

          let top = null;
          let left = null;
          let right = null;
          let bottom = null;
          let hadTransparent = false;

          // Determining the non-transparent region of the image
          for (let y = 0; y <= height; y++) {
            let isTransparent = true;
            for (let x = 0; x <= width; x++) {
              if (Jimp.intToRGBA(image.getPixelColor(x, y)).a != 0) {
                isTransparent = false;
                break;
              }
            }
            if (!isTransparent && hadTransparent) {
              top = y;
              break;
            } else {
              hadTransparent = true;
            }
          }

          hadTransparent = false;
          for (let y = height; y >= 0; y--) {
            let isTransparent = true;
            for (let x = 0; x <= width; x++) {
              if (Jimp.intToRGBA(image.getPixelColor(x, y)).a != 0) {
                isTransparent = false;
                break;
              }
            }
            !isTransparent && hadTransparent ? bottom = y : hadTransparent = true;
          }

          hadTransparent = false;
          for (let x = 0; x <= width; x++) {
            let isTransparent = true;
            for (let y = 0; y <= height; y++) {
              if (Jimp.intToRGBA(image.getPixelColor(x, y)).a != 0) {
                isTransparent = false;
                break;
              }
            }
            if (!isTransparent && hadTransparent) {
              left = x;
              break;
            } else {
              hadTransparent = true;
            }
          }

          hadTransparent = false;
          for (let x = width; x >= 0; x--) {
            let isTransparent = true;
            for (let y = 0; y <= height; y++) {
              if (Jimp.intToRGBA(image.getPixelColor(x, y)).a != 0) {
                isTransparent = false;
                break;
              }
            }
            !isTransparent && hadTransparent ? right = x : hadTransparent = true;
          }

          if (!top) top = 0;
          if (!left) left = 0;
          if (!right) right = 0;
          if (!bottom) bottom = 0;

          const x = width - left - right;
          const y = height - top - bottom;

          // Cropping the image to the non-transparent region and resizing it to a square
          image.crop(left, top, x, y);
          const size = Math.max(x, y);
          const newImage = new Jimp(size, size, 0x00000000);
          const newX = Math.floor((size / 2) - (x / 2));
          const newY = Math.floor((size / 2) - (y / 2));
          newImage.composite(image, newX, newY);

          // Saving the extracted image
          newImage.write(`./png/${item}.png`);
        });
        console.log(`Dumping files ${item} (${statusIcon})`);
      }
    }
  }
});