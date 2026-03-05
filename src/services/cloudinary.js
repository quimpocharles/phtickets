const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const bannerStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ticket-sys/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 400, crop: 'fill' }],
  },
});

const uploadBanner = multer({ storage: bannerStorage }).single('bannerImage');

const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ticket-sys/team-logos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'center' }],
  },
});

const uploadTeamLogo = multer({ storage: logoStorage }).single('logo');

/**
 * Upload a QR code buffer directly to Cloudinary.
 * @param {Buffer} buffer - PNG buffer from the qrcode library
 * @param {string} ticketId - used as the public_id
 * @returns {Promise<string>} secure URL
 */
async function uploadQRCode(buffer, ticketId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'ticket-sys/qrcodes',
        public_id: ticketId,
        format: 'png',
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBanner, uploadTeamLogo, uploadQRCode };
