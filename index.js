const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');
require('dotenv').config();

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataApiSecret = process.env.PINATA_API_SECRET;
const pinatajwt = process.env.PINATA_JWT;

// Function to generate certificate
async function generateCertificate(userName, score, qrData, date) {
  const template = await loadImage('./template/certTemplate.png');
  const canvas = createCanvas(template.width, template.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(template, 0, 0);
  ctx.font = '20px Arial';
  ctx.fillStyle = 'black';
  ctx.fillText(userName, 30, 170);
  ctx.fillText(score, 300, 170);
  ctx.fillText(date, 300, 410);

  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'L',
    type: 'image/png',
    width: 200,
    margin: 4
  });

  const qrCodeImage = await loadImage(qrCodeDataUrl);
  ctx.drawImage(qrCodeImage, 240, 200);

  const outputPath = './output/generated_certificate.png';
  fs.mkdirSync('output', { recursive: true });
  const out = fs.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  await new Promise(resolve => out.on('finish', resolve));

  return outputPath;
}

// Function to upload file to Pinata
async function uploadToPinata(filePath) {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  const headers = {
    // Authorization: `Bearer ${pinatajwt}`,
    pinata_api_key: pinataApiKey,
    pinata_secret_api_key: pinataApiSecret,
    ...form.getHeaders()
  };

  try {
    const response = await axios.post(url, form, { headers });
    return response.data.IpfsHash;
  } catch (err) {
    console.error('Error uploading to Pinata:', err.response ? err.response.data : err.message);
    throw err;
  }
}

// Example usage
async function generateAndUploadToPinata(userName, score, date, qrData) {
  try {
    const outputPath = await generateCertificate(userName, score, qrData, date);
    const certificateIpfsHash = await uploadToPinata(outputPath);

    const metadata = {
      name: 'Quiz Certificate NFT',
      description: 'Certificate for completing the quiz',
      image: `ipfs://${certificateIpfsHash}`,
      attributes: [
        { trait_type: 'Name', value: userName },
        { trait_type: 'Score', value: score },
        { trait_type: 'Date', value: date },
      ],
    };

    const metadataPath = './output/metadata.json';
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    const metadataIpfsHash = await uploadToPinata(metadataPath);
    const metadataIpfsUrl = `ipfs://${metadataIpfsHash}`;
    console.log(`Metadata IPFS URL: ${metadataIpfsUrl}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generateAndUploadToPinata('User JS 2', '80/100', '06/26/2024', 'http://localhost/test');
