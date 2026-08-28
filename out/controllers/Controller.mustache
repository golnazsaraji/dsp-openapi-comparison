const fs = require('fs');
const path = require('path');
const camelCase = require('camelcase');
const config = require('../config');
const logger = require('../logger');
const { runWithRequestIdentity } = require('../../adapters/openapi-generator/sessionAuth');

class Controller {
  static sendResponse(response, payload) {
    /**
    * The default response-code is 200. We want to allow to change that. in That case,
    * payload will be an object consisting of a code and a payload. If not customized
    * send 200 and the payload as received in this method.
    */
    if (payload.cookie) {
      response.cookie(payload.cookie.name, payload.cookie.value, payload.cookie.options);
    }
    response.status(payload.code || 200);
    const responsePayload = payload.payload !== undefined ? payload.payload : payload;
    if (responsePayload?.kind === 'json') {
      response.status(responsePayload.status || payload.code || 200).json(responsePayload.body);
      return;
    }
    if (responsePayload?.kind === 'no-content') {
      response.status(responsePayload.status || 204).end();
      return;
    }
    if (responsePayload?.kind === 'file') {
      response.status(responsePayload.status || payload.code || 200);
      response.type(responsePayload.mediaType);
      if (Number.isInteger(responsePayload.length)) response.set('Content-Length', String(responsePayload.length));
      const stream = fs.createReadStream(responsePayload.filePath);
      stream.on('error', (error) => {
        logger.error('Unable to stream stored image representation', error);
        if (!response.headersSent) response.status(500).json({ error: 'Stored image representation is unavailable.' });
        else response.destroy();
      });
      stream.pipe(response);
      return;
    }
    if (responsePayload instanceof Object) {
      response.json(responsePayload);
    } else if (responsePayload !== undefined && responsePayload !== null) {
      response.json(responsePayload);
    } else {
      response.end();
    }
  }

  static sendError(response, error) {
    const statusCode = Number.isInteger(error.code) ? error.code : 500;
    response.status(statusCode);
    if (error.error instanceof Object) {
      response.json(error.error);
    } else {
      response.json({ error: error.error || error.message || 'Internal server error.' });
    }
  }

  /**
  * Files have been uploaded to the directory defined by config.js as upload directory
  * Files have a temporary name, that was saved as 'filename' of the file object that is
  * referenced in request.files array.
  * This method passes a safe temporary storage key and client metadata to handwritten logic.
  * Validation and the final server-generated storage key are owned by the shared image service.
  * @param request
  * @param fieldName
  * @returns {object|undefined}
  */
  static collectFile(request, fieldName) {
    const files = (request.files || []).filter((file) => file.fieldname === fieldName);
    if (files.length > 1 || (request.files || []).length > 1) {
      const error = new Error('Exactly one image file is allowed per request.');
      error.code = 400;
      throw error;
    }
    const fileObject = files[0];
    if (!fileObject) return undefined;
    return {
      originalName: fileObject.originalname,
      storedName: fileObject.filename,
      mimeType: fileObject.mimetype,
      size: fileObject.size,
    };
  }

  static cleanupRequestFiles(request) {
    (request.files || []).forEach((file) => {
      try {
        fs.unlinkSync(path.join(config.FILE_UPLOAD_PATH, path.basename(file.filename)));
      } catch (error) {
        if (error.code !== 'ENOENT') logger.error('Failed to clean rejected upload', error);
      }
    });
  }

  static getRequestBodyName(request) {
    const codeGenDefinedBodyName = request.openapi.schema['x-codegen-request-body-name']
      || request.openapi.schema.requestBody?.['x-codegen-request-body-name'];
    if (codeGenDefinedBodyName !== undefined) {
      return codeGenDefinedBodyName;
    }
    const refObjectPath = request.openapi.schema.requestBody.content['application/json'].schema.$ref;
    if (refObjectPath !== undefined && refObjectPath.length > 0) {
      return (refObjectPath.substr(refObjectPath.lastIndexOf('/') + 1));
    }
    return 'body';
  }

  static collectRequestParams(request) {
    const requestParams = {};
    if (request.openapi.schema.requestBody !== null) {
      const { content } = request.openapi.schema.requestBody;
      if (content['application/json'] !== undefined) {
        const requestBodyName = camelCase(this.getRequestBodyName(request));
        requestParams[requestBodyName] = request.body;
      } else if (content['multipart/form-data'] !== undefined) {
        Object.keys(content['multipart/form-data'].schema.properties).forEach(
          (property) => {
            const propertyObject = content['multipart/form-data'].schema.properties[property];
            if (propertyObject.format !== undefined && propertyObject.format === 'binary') {
              requestParams[property] = this.collectFile(request, property);
            } else {
              requestParams[property] = request.body[property];
            }
          },
        );
      }
    }

    if (request.openapi.schema.parameters !== undefined) {
      request.openapi.schema.parameters.forEach((param) => {
        if (param.in === 'path') {
          requestParams[param.name] = request.openapi.pathParams[param.name];
        } else if (param.in === 'query') {
          requestParams[param.name] = request.query[param.name];
        } else if (param.in === 'header') {
          requestParams[param.name] = request.headers[param.name];
        }
      });
    }
    return requestParams;
  }

  static async handleRequest(request, response, serviceOperation) {
    try {
      // Multipart parsing may cross an async boundary created before the request identity
      // context. Rebind the authenticated Passport user immediately around service dispatch.
      const serviceResponse = await runWithRequestIdentity(
        request,
        () => serviceOperation(this.collectRequestParams(request)),
      );
      Controller.sendResponse(response, serviceResponse);
    } catch (error) {
      Controller.cleanupRequestFiles(request);
      Controller.sendError(response, error);
    }
  }
}

module.exports = Controller;
