import { readFileSync, writeFileSync, existsSync, createReadStream, createWriteStream } from 'fs';

export const backupAndWriteFile = (filePath, data) => {
    if (existsSync(filePath)) {
        const backupFilePath = `${filePath}.bak`;
        const readStream = createReadStream(filePath);
        const writeStream = createWriteStream(backupFilePath);

        readStream.pipe(writeStream); // Create a backup using streams
    }
    writeFileSync(filePath, data); // Write the new file
}