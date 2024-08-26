const GooglePhotosAlbum = require('google-photos-album-image-url-fetch');
const axios = require('axios');
const fs = require('fs').promises;

function run() {
    fs.mkdir('./images/domicil', {recursive: true}).catch(err => console.error(err));

    fetchImages().catch(err => console.error(err));
    setInterval(fetchImages, 7200000);
}

async function fetchImages() {
    const pictures = await GooglePhotosAlbum.fetchImageUrls(process.env.GOOGLE_PHOTO_ALBUM);
    for (const picture of pictures) {
        const imageResponse = await axios.default.get(`${picture.url}=w${picture.width}-h${picture.height}`, {responseType: 'arraybuffer'});

        await fs.writeFile(`./images/domicil/${picture.imageUpdateDate}.png`, imageResponse.data);
    }
}

module.exports = run;