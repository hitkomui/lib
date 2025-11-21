import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src/assets/image');
const distDir = path.join(__dirname, '../src/assets/image'); // Convert in place or to dist? Usually source images are converted to webp in source or during build. 
// The user asked for "sharpeでwebp化対応" (support webp conversion with sharp).
// Let's assume we want to convert images in src/assets/image to webp in the same folder or a specific one.
// For now, let's convert in place so they can be referenced.

if (!fs.existsSync(srcDir)) {
    console.error(`Source directory ${srcDir} does not exist.`);
    process.exit(1);
}

fs.readdir(srcDir, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    files.forEach(file => {
        if (file.match(/\.(jpg|jpeg|png)$/i)) {
            const inputFile = path.join(srcDir, file);
            const outputFile = path.join(srcDir, path.parse(file).name + '.webp');

            sharp(inputFile)
                .webp({ quality: 80 })
                .toFile(outputFile)
                .then(info => {
                    console.log(`Converted ${file} to WebP`);
                })
                .catch(err => {
                    console.error(`Error converting ${file}:`, err);
                });
        }
    });
});
