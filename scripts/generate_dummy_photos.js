const fs = require('fs');
const path = require('path');

// Minimal JPEG data (1x1 pixel) base64
const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEBEQEBAQEA8PDw8PDw8PDw8QFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tKy0tLS0tKy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKIBNQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAABAgT/xAAdEAACAgIDAQAAAAAAAAAAAAABAgADEQQFEjFh/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEB/9oADAMBAAIRAxEAPwDUU0UUAf/9k=';
const jpegBuffer = Buffer.from(jpegBase64, 'base64');

const root = path.resolve(process.cwd(), 'Mexico 2025 - Ben and Vicky');
const folders = [
  '🇲🇽 Mexico 2025_phones',
  'Day1_PlayaDelCarmen',
  'Day2_CozumelDiving',
  'Day3_Cozumel',
  'Day4_ChichenItza',
  'Day5_Valladolid',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFileWithMtime(filePath, buffer, mtime) {
  fs.writeFileSync(filePath, buffer);
  const atime = new Date();
  fs.utimesSync(filePath, atime, mtime);
}

ensureDir(root);

// Mexico 2025_phones: 1 file Dec 19 2025, 1 file Nov 15 2025
const phonesDir = path.join(root, folders[0]);
ensureDir(phonesDir);
writeFileWithMtime(path.join(phonesDir, 'PHONE_IMG_001.jpg'), jpegBuffer, new Date('2025-12-19T12:00:00Z'));
writeFileWithMtime(path.join(phonesDir, 'PHONE_IMG_002.jpg'), jpegBuffer, new Date('2025-11-15T12:00:00Z'));

// Day1: Nov 9th -> 2 files
const day1 = path.join(root, folders[1]);
ensureDir(day1);
writeFileWithMtime(path.join(day1, 'IMG_20251109_01.jpg'), jpegBuffer, new Date('2025-11-09T09:00:00Z'));
writeFileWithMtime(path.join(day1, 'IMG_20251109_02.jpg'), jpegBuffer, new Date('2025-11-09T10:00:00Z'));

// Day2: Nov 10th -> 3 files
const day2 = path.join(root, folders[2]);
ensureDir(day2);
writeFileWithMtime(path.join(day2, 'IMG_20251110_01.jpg'), jpegBuffer, new Date('2025-11-10T09:00:00Z'));
writeFileWithMtime(path.join(day2, 'IMG_20251110_02.jpg'), jpegBuffer, new Date('2025-11-10T10:00:00Z'));
writeFileWithMtime(path.join(day2, 'IMG_20251110_03.jpg'), jpegBuffer, new Date('2025-11-10T11:00:00Z'));

// Day3: Nov 11th -> 2 files
const day3 = path.join(root, folders[3]);
ensureDir(day3);
writeFileWithMtime(path.join(day3, 'IMG_20251111_01.jpg'), jpegBuffer, new Date('2025-11-11T09:00:00Z'));
writeFileWithMtime(path.join(day3, 'IMG_20251111_02.jpg'), jpegBuffer, new Date('2025-11-11T10:00:00Z'));

// Day4: Nov 12th -> 2 files
const day4 = path.join(root, folders[4]);
ensureDir(day4);
writeFileWithMtime(path.join(day4, 'IMG_20251112_01.jpg'), jpegBuffer, new Date('2025-11-12T09:00:00Z'));
writeFileWithMtime(path.join(day4, 'IMG_20251112_02.jpg'), jpegBuffer, new Date('2025-11-12T10:00:00Z'));

// Day5: Nov 13th -> 2 files
const day5 = path.join(root, folders[5]);
ensureDir(day5);
writeFileWithMtime(path.join(day5, 'IMG_20251113_01.jpg'), jpegBuffer, new Date('2025-11-13T09:00:00Z'));
writeFileWithMtime(path.join(day5, 'IMG_20251113_02.jpg'), jpegBuffer, new Date('2025-11-13T10:00:00Z'));

console.log('Dummy photo folder created at', root);
