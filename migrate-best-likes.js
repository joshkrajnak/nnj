const fs = require('fs');

// Load your current best-likes.json (update path as needed)
const oldPath = './best-likes.json';
const newPath = './best-likes.json'; // Overwrite same file

const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
const newData = {};

for (const username in oldData) {
  newData[username] = {
    count: oldData[username],
    nickname: username // Default nickname to username
  };
}

fs.writeFileSync(newPath, JSON.stringify(newData, null, 2));
console.log('Migration complete! best-likes.json is now in the new format.');