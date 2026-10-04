const fs = require('fs');
fs.writeFileSync('C:\\Users\\HP\\OneDrive\\Desktop\\betplatform\\cjs_test.txt', 'CJS WORKED AT ' + new Date().toISOString(), 'utf8');
console.log('CJS execution successful');
