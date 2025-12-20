const Queue = require('better-queue');
const fs = require('fs-extra');
const path = require('path');
const stateService = require('./stateService');

let fileQueue = null;

const ensureQueue = () => {
  if (!fileQueue) {
    fileQueue = new Queue(
      async (task, cb) => {
        try {
          const result = await processTask(task);
          cb(null, result);
        } catch (err) {
          cb(err);
        }
      },
      { concurrent: 1 },
    );
  }
  return fileQueue;
};

const processTask = async task => {
  const { type, payload, rootPath } = task;
  const state = await stateService.loadState(rootPath);

  if (type === 'ASSIGN') {
    const { photoId, bucket, day } = payload;
    const photo = state.photos.find(p => p.id === photoId);
    if (!photo) throw new Error('Photo not found');

    const oldPath = photo.filePath;

    let newFilename = '';
    let destFolder = '';
    let sequence = null;

    if (bucket === 'X') {
      destFolder = path.join(rootPath, '98_ARCHIVE');
      newFilename = photo.originalName;
    } else {
      const dayStr = `D${String(day).padStart(2, '0')}`;
      destFolder = path.join(rootPath, '01_DAYS', dayStr);
      await fs.ensureDir(destFolder);

      const existing = state.photos.filter(
        p => p.day === day && p.bucket === bucket && p.id !== photoId,
      );
      const maxSeq = existing.reduce((max, p) => ((p.sequence || 0) > max ? p.sequence : max), 0);
      sequence = maxSeq + 1;

      const seqStr = String(sequence).padStart(3, '0');
      newFilename = `${dayStr}_${bucket}_${seqStr}__${photo.originalName}`;
    }

    const newPath = path.join(destFolder, newFilename);

    if (oldPath !== newPath) {
      await fs.move(oldPath, newPath, { overwrite: false });
    }

    const beforeState = JSON.parse(JSON.stringify(photo));

    photo.bucket = bucket;
    photo.day = bucket === 'X' ? null : day;
    photo.sequence = sequence;
    photo.archived = bucket === 'X';
    photo.currentName = newFilename;
    photo.filePath = newPath;

    await stateService.saveState(rootPath, state);

    await stateService.appendHistory(rootPath, {
      type: 'ASSIGN',
      photoId,
      before: beforeState,
      after: photo,
    });

    return photo;
  }

  if (type === 'UNDO') {
    const entry = await stateService.popHistory(rootPath);
    if (!entry) throw new Error('Nothing to undo');

    if (entry.type === 'ASSIGN') {
      const currentPhoto = state.photos.find(p => p.id === entry.photoId);
      const prevData = entry.before;

      await fs.move(currentPhoto.filePath, prevData.filePath);

      Object.assign(currentPhoto, prevData);
      await stateService.saveState(rootPath, state);

      return state.photos;
    }
  }
};

module.exports = { ensureQueue };
