const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const path = require('path');

cloudinary.config({
  cloud_name: 'dpi0uk9kb',
  api_key: '273978187518297',
  api_secret: '2C3vJzGbH1CR_aLnGWnbB3NMCmQ'
});

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'];

function isImage(filename) {
  return IMAGE_EXTS.includes(path.extname(filename).toLowerCase());
}

async function uploadPhoto(fileBuffer, originalName, entryId) {
  const ext = path.extname(originalName).toLowerCase();
  const filename = uuidv4();
  const isImg = isImage(originalName);

  const uploadOptions = {
    folder: `mcc-evidence/${entryId}`,
    public_id: filename,
    resource_type: isImg ? 'image' : 'raw'
  };

  // Compress images
  if (isImg) {
    uploadOptions.transformation = [
      { quality: 'auto:good', fetch_format: 'auto' }
    ];
  }

  // For raw files, preserve original extension in the public_id
  if (!isImg) {
    uploadOptions.public_id = filename + ext;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          filename: originalName,
          type: result.resource_type,
          format: result.format || ext.replace('.', ''),
          size: result.bytes
        });
      }
    );
    stream.on('error', (err) => reject(err));
    stream.end(fileBuffer);
  });
}

async function deleteEntryPhotos(entryId) {
  try {
    for (const resource_type of ['image', 'raw', 'video']) {
      try {
        const { resources } = await cloudinary.api.resources({
          type: 'upload',
          prefix: `mcc-evidence/${entryId}`,
          resource_type,
          max_results: 500
        });
        for (const r of resources) {
          await cloudinary.uploader.destroy(r.public_id, { resource_type });
        }
      } catch (e) {
        // ignore if no resources of this type
      }
    }
  } catch (err) {
    console.error('Delete photos error:', err.message);
  }
}

module.exports = { uploadPhoto, deleteEntryPhotos };
