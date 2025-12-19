const express = require('express');
const router = express.Router();
const projectController = require('./controllers/projectController');
const photoController = require('./controllers/photoController');

router.post('/project/init', projectController.initProject);

router.get('/project/state', projectController.getState);
router.post('/project/state', projectController.saveState);

router.post('/photo/assign', photoController.assignPhoto);
router.post('/photo/batch', photoController.batchOperation);
router.post('/photo/favorite', photoController.toggleFavorite);

router.post('/history/undo', photoController.undo);

router.post('/export/slideshow', projectController.exportSlideshow);

router.get('/thumbnail/:path(*)', photoController.serveThumbnail);

module.exports = router;
