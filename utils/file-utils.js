import { readFileSync, writeFileSync, readdir, existsSync, createReadStream, createWriteStream } from 'fs';
import crypto from 'crypto';
import path from 'path';

export const backupAndWriteFile = (filePath, data) => {
    if (existsSync(filePath)) {
        const backupFilePath = `${filePath}.bak`;
        const readStream = createReadStream(filePath);
        const writeStream = createWriteStream(backupFilePath);

        readStream.pipe(writeStream); // Create a backup using streams
        readStream.on('end', () => {
            const newWriteStream = createWriteStream(filePath);
            newWriteStream.write(data, 'utf8');
            newWriteStream.end();
        });
    } else {
        const writeStream = createWriteStream(filePath);
        writeStream.write(data, 'utf8');
        writeStream.end();
    }
    // writeFileSync(filePath, data); // Write the new file
}

export const readJSONFiles = (folderPath) => {
    const globalArray = []
    readdir(folderPath, (err, files) => {
        if (err) {
            console.error('Error reading folder:', err);
            return;
        }
        files.forEach(file => {
            if (path.extname(file) === '.json') {
                const filePath = path.join(folderPath, file);
                console.log('Reading ', filePath)
                const fileContent = readFileSync(filePath, 'utf8');
                const jsonElements = JSON.parse(fileContent);
                globalArray.push(...jsonElements);
            }
        });
    })
    return globalArray
}

// Calculate the hash of a file
export function calculateHash(filePath) {
    const fileData = readFileSync(filePath);
    return crypto.createHash('sha256').update(fileData).digest('hex');
}
