const GooglePhotosAlbum = require('google-photos-album-image-url-fetch');
const axios = require('axios');
const fs = require('fs').promises;

function run() {
    fs.mkdir('./images/domicil', {recursive: true}).catch(err => console.error(err));
    fs.mkdir('./images/domicil/recycle', {recursive: true}).catch(err => console.error(err));

    fetchImages().catch(err => console.error(err));
    setInterval(fetchImages, 7200000);
}

async function fetchImages() {
    const pictures = await GooglePhotosAlbum.fetchImageUrls(process.env.GOOGLE_PHOTO_ALBUM);
    console.log(`Found ${pictures.length} domicil pictures from Google.`);
    for (const picture of pictures) {
        const imageResponse = await axios.default.get(`${picture.url}=w${picture.width}-h${picture.height}`, {responseType: 'arraybuffer'});

        await fs.writeFile(`./images/domicil/${picture.imageUpdateDate}.png`, imageResponse.data);
    }

    await cleanPhotos(pictures);
}

async function cleanPhotos(newPhotos) {
    const oldPhotos = await fs.readdir('/images/domicil', {withFileTypes: false});
    const newPhotoNames = newPhotos.map(it => it.imageUpdateDate);
    let recycled = 0;

    for (const photo of oldPhotos) {
        if (!newPhotoNames.contains(photo.imageUpdateDate)) {
            await fs.rename(`./images/domicil/${photo}.png`, `./images/domicil/recycle/${photo}.png`);
            recycled++;
        }
    }

    console.log(`Recycled ${recycled} pictures.`);
}

module.exports = run;