const axios = require('axios');
const {DateTime, Duration} = require('luxon');
const util = require('util');
const Openai = require('openai');
const crypto = require('crypto');
const fs = require('fs').promises;

const openai = new Openai({
    apiKey: process.env.OPENAI_API_KEY,
});

// Interval in minutes between cleanups of image files.
const fileCleanupInterval = 1440;

// Interval in minutes between food data fetches.
const fetchFoodDataInterval = 1440;

function run(connection) {
    const query = util.promisify(connection.query).bind(connection);

    fs.mkdir('./images').catch(err => console.error(err));

    bulkUpdateFoodData(query).then(_ => setTimeout(bulkUpdateFoodData, fetchFoodDataInterval * 60000, query));
    cleanImages(query).then(_ => setTimeout(cleanImages, fileCleanupInterval * 60000, query));
}

async function bulkUpdateFoodData(query) {
    await fetchFoodData(query);
    await checkFoodContents(query, ['fisk', 'svinekød', 'kød', 'laktosefri', 'fjerkræ', 'vegansk']);
    await correctFoodName(query);
    await describeFoodItems(query);
    await generateImages(query);
}

async function fetchFoodData(query) {
    console.log(`Fetching menu items...`);

    let totalDays = 0;

    let dateToCheck = DateTime.now();
    do {
        const res = await axios.default.get('https://www.shop.foodandco.dk/api/WeeklyMenu', {
            params: {
                restaurantId: 1089,
                languageCode: 'da-DK',
                date: dateToCheck.toFormat('yyyy-MM-dd'),
            },
        });

        totalDays += res.data.days.length;

        for (const day of res.data.days) {
            try {
                await query('INSERT INTO menus (date, day, food_name, week_number) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE day=IF(manual, day, ?), food_name=IF(manual, food_name, ?), week_number=IF(manual, week_number, ?)', [day.date, day.dayOfWeek, day.menus[0]?.menu, res.data.weekNumber, day.dayOfWeek, day.menus[0]?.menu, res.data.weekNumber]);
            } catch (error) {
                console.error(error);
            }
        }

        if (res.data.days.length === 0) {
            dateToCheck = null;
        } else {
            dateToCheck = dateToCheck.plus(Duration.fromObject({weeks: 1}));
        }
    } while (dateToCheck !== null);

    console.log(`Found ${totalDays} menu items.`);
}

async function checkFoodContents(query, foodTypes) {
    console.log(`Updating the food contents of menu items...`);
    try {
        const results = await query('SELECT * FROM menus WHERE food_contents IS NULL');

        for (const result of results) {
            result.food_contents = [];
            for (const foodType of foodTypes) {
                const completion = await openai.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: `Din opgave er at afgøre om der er ${foodType} i denne ret. Hvis den indeholder ${foodType} skal du svare med "ja" og ikke andet. Hvis ikke den indeholder ${foodType} skal du svare med "nej" og ikke andet.`,
                        },
                        {
                            role: 'user',
                            content: `Retten hedder "${result.food_name}"`,
                        },
                    ],
                    model: 'gpt-4o',
                });

                const response = completion.choices[0].message.content.toLowerCase();

                if (response === 'ja') {
                    result.food_contents.push(foodType);
                }
            }

            await query('UPDATE menus SET food_contents = ? WHERE date = ?', [JSON.stringify(result.food_contents), result.date]);
        }

        console.log(`Updated the food contents of ${results.length} menu items.`);
    } catch (error) {
        console.error(error);
    }
}

async function correctFoodName(query) {
    console.log(`Correcting the grammar in food names...`);
    try {
        const results = await query('SELECT date, food_name, corrected_food_name FROM menus WHERE menus.corrected_food_name is null');

        for (const result of results) {
            const completion = await openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `Din opgave er at omskrive navnet på madretter til at være grammatisk korrekt og stavet rigtigt. Undgå at slutte med tegnsætning. Forkortelser må gerne bruges eller bibeholdes. Du skal kun svare med navnet og intet andet.`,
                    },
                    {
                        role: 'user',
                        content: `Retten hedder "${result.food_name}"`,
                    },
                ],
                model: 'gpt-4o',
            });

            result.corrected_food_name = completion.choices[0].message.content;

            await query('UPDATE menus SET corrected_food_name = ? WHERE date = ?', [result.corrected_food_name, result.date]);
        }

        console.log(`Corrected the food name of ${results.length} menu items.`);
    } catch (error) {
        console.error(error);
    }
}

async function describeFoodItems(query) {
    console.log(`Describing the menu items...`);
    try {
        const results = await query('SELECT date, food_name, corrected_food_name, food_description FROM menus WHERE menus.food_description is null');

        for (const result of results) {
            let dishName = result.food_name;
            if (result.corrected_food_name !== null) {
                dishName = result.corrected_food_name;
            }

            const completion = await openai.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `Din opgave er at beskrive madretter på en kort måde. Du skal svare med kun beskrivelsen og intet andet.`,
                    },
                    {
                        role: 'user',
                        content: `Retten hedder "${dishName}"`,
                    },
                ],
                model: 'gpt-4o',
            });

            result.food_description = completion.choices[0].message.content;

            await query('UPDATE menus SET food_description = ? WHERE date = ?', [result.food_description, result.date]);
        }

        console.log(`Described ${results.length} menu items.`);
    } catch (error) {
        console.error(error);
    }
}

async function generateImages(query) {
    console.log(`Updating the images of menu items...`);
    try {
        const results = await query('SELECT * FROM menus LEFT JOIN images ON images.menu_date = menus.date WHERE menu_date IS NULL');

        for (const result of results) {
            const response = await openai.images.generate({
                model: 'dall-e-3',
                prompt: `Food called "${result.food_name}"`,
                n: 1,
                size: '1792x1024',
                quality: 'hd',
            });

            const filename = crypto.randomBytes(4).toString('hex');

            const imageResponse = await axios.default.get(response.data[0].url, {responseType: 'arraybuffer'});

            await fs.writeFile(`./images/${filename}.png`, imageResponse.data);

            await query('INSERT INTO images (menu_date, path, prompt, revised_prompt) VALUES (?, ?, ?, ?)', [result.date, `${filename}.png`, `Food called "${result.food_name}"`, response.data[0].revised_prompt]);
        }

        console.log(`Updated the images of ${results.length} menu items.`);
    } catch (error) {
        console.error(error);
    }
}

async function cleanImages(query) {
    console.log(`Deleting unreferenced images...`);
    try {
        const results = await query('SELECT path FROM images');
        const referencedImages = results.map(it => it.path);

        const files = await fs.readdir('./images');
        const filesToDelete = files.filter(it => !referencedImages.includes(it));

        for (const file of filesToDelete) {
            await fs.rm(`./images/${file}`);
        }
        console.log(`Deleted ${filesToDelete.length} unreferenced images.`);
    } catch (error) {
        console.error(error);
    }
}

module.exports = run;