const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const exifr = require('exifr');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const stateService = require('./stateService');

const SUPPORTED_EXT = ['jpg', 'jpeg', 'png', 'heic', 'webp'];

const initProject = async rootPath => {
  if (!fs.existsSync(rootPath)) throw new Error('Root path does not exist');

  const dirs = ['01_DAYS', '98_ARCHIVE', 'FAV', '99_EXPORTS', '_meta', '_meta/thumbnails'];
  for (const d of dirs) {
    await fs.ensureDir(path.join(rootPath, d));
  }

  const pattern = `**/*.{${SUPPORTED_EXT.join(',')}}`;
  const files = await glob.glob(pattern, {
    cwd: rootPath,
    absolute: true,
    ignore: ['**/_meta/**', '**/99_EXPORTS/**'],
  });

  const photos = [];
  const thumbnailQueue = [];

  console.log(`Found ${files.length} files. Parsing EXIF...`);

  for (const filePath of files) {
    try {
      const stats = await fs.stat(filePath);
      let exif = {};
      try {
        exif =
          (await exifr.parse(filePath, ['DateTimeOriginal', 'Make', 'Model', 'Orientation'])) || {};
      } catch (e) {
        // Ignore EXIF errors, fall back to file metadata.
      }

      const timestamp = exif.DateTimeOriginal
        ? new Date(exif.DateTimeOriginal).getTime()
        : stats.mtimeMs;

      const id = uuidv4();
      const originalName = path.basename(filePath);

      const thumbFilename = `${id}.jpg`;
      const thumbPath = path.join(rootPath, '_meta/thumbnails', thumbFilename);

      thumbnailQueue.push({ src: filePath, dest: thumbPath });

      photos.push({
        id,
        originalName,
        currentName: originalName,
        timestamp,
        day: null,
        bucket: null,
        sequence: null,
        favorite: false,
        rating: 0,
        archived: false,
        thumbnail: `_meta/thumbnails/${thumbFilename}`,
        filePath,
        metadata: {
          camera: `${exif.Make || ''} ${exif.Model || ''}`.trim(),
          width: exif.ExifImageWidth,
          height: exif.ExifImageHeight,
        },
      });
    } catch (err) {
      console.error(`Skipping file ${filePath}:`, err.message);
    }
  }

  await generateThumbnailsBatch(thumbnailQueue);

  const newState = {
    projectName: path.basename(rootPath),
    rootPath,
    photos: photos.sort((a, b) => a.timestamp - b.timestamp),
    settings: {
      autoDay: true,
      folderStructure: {
        daysFolder: '01_DAYS',
        archiveFolder: '98_ARCHIVE',
        favoritesFolder: 'FAV',
        metaFolder: '_meta',
      },
    },
    lastModified: Date.now(),
  };

  await stateService.saveState(rootPath, newState);

  const suggestedDays = clusterPhotosByTime(newState.photos);

  return {
    photos: newState.photos,
    suggestedDays,
  };
};

async function generateThumbnailsBatch(queue) {
  const BATCH_SIZE = 10;
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(item =>
        sharp(item.src)
          .resize(400, 300, { fit: 'cover' })
          .jpeg({ quality: 70 })
          .rotate()
          .toFile(item.dest)
          .catch(err => console.error(`Thumb failed: ${item.src}`, err)),
      ),
    );
  }
}

function clusterPhotosByTime(photos) {
  const days = {};
  let currentDay = 1;
  if (photos.length === 0) return {};

  let lastTime = photos[0].timestamp;
  const GAP_THRESHOLD = 6 * 60 * 60 * 1000;

  days[currentDay] = [];

  photos.forEach(p => {
    if (p.timestamp - lastTime > GAP_THRESHOLD) {
      currentDay++;
      days[currentDay] = [];
    }
    days[currentDay].push(p.id);
    lastTime = p.timestamp;
  });
  return days;
}

module.exports = { initProject };
