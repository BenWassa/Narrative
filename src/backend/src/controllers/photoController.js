const { ensureQueue } = require('../services/queueService');
const stateService = require('../services/stateService');

exports.assignPhoto = (req, res) => {
  const { photoId, bucket, day, rootPath } = req.body;

  ensureQueue()
    .push({
      type: 'ASSIGN',
      rootPath,
      payload: { photoId, bucket, day },
    })
    .on('finish', result => {
      res.json({ success: true, photo: result });
    })
    .on('failed', err => {
      res.status(500).json({ success: false, error: err.message });
    });
};

exports.undo = (req, res) => {
  const { rootPath } = req.body;
  ensureQueue()
    .push({
      type: 'UNDO',
      rootPath,
      payload: {},
    })
    .on('finish', photos => {
      res.json({ success: true, photos });
    })
    .on('failed', err => {
      res.status(500).json({ success: false, error: err.message });
    });
};

exports.toggleFavorite = async (req, res) => {
  const { rootPath, photoId, favorite } = req.body;
  try {
    const state = await stateService.loadState(rootPath);
    const photo = state.photos.find(p => p.id === photoId);
    if (photo) {
      photo.favorite = favorite;
      await stateService.saveState(rootPath, state);
      res.json({ success: true, photo });
    } else {
      res.status(404).json({ success: false, message: 'Photo not found' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.batchOperation = (req, res) => {
  res.status(501).json({ message: 'Not implemented in this snippet' });
};

exports.serveThumbnail = (req, res) => {
  const filePath = req.params[0];
  res.send('Image data');
};
