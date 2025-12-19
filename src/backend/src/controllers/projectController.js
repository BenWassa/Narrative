const projectService = require('../services/projectService');
const stateService = require('../services/stateService');

exports.initProject = async (req, res) => {
  try {
    const { rootPath } = req.body;
    const data = await projectService.initProject(rootPath);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getState = async (req, res) => {
  const rootPath = req.query.rootPath;
  try {
    const state = await stateService.loadState(rootPath);
    res.json(state);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.saveState = async (req, res) => {
  const { rootPath, state } = req.body;
  try {
    await stateService.saveState(rootPath, state);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.exportSlideshow = async (req, res) => {
  res.json({ success: true, message: 'Export logic placeholder' });
};
