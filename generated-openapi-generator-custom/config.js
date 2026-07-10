const path = require('path');
const fs = require('fs');

const fileUploadPath = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '..', 'runtime-data', 'uploaded_files'),
);
fs.mkdirSync(fileUploadPath, { recursive: true });

const config = {
  ROOT_DIR: __dirname,
  URL_PORT: Number(process.env.PORT || 3000),
  URL_PATH: 'http://localhost',
  BASE_VERSION: '',
  CONTROLLER_DIRECTORY: path.join(__dirname, 'controllers'),
  PROJECT_DIR: __dirname,
};
config.OPENAPI_YAML = path.join(config.ROOT_DIR, 'api', 'openapi.yaml');
config.FULL_PATH = `${config.URL_PATH}:${config.URL_PORT}/${config.BASE_VERSION}`;
config.FILE_UPLOAD_PATH = fileUploadPath;

module.exports = config;
